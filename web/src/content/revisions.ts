import mongoose, { type ClientSession, type HydratedDocument, type Model, type Types } from "mongoose";
import { Revision } from "@/models";

export type SaveOptions = { session?: ClientSession };

type RevisionRow = {
  _id: Types.ObjectId;
  entityType: string;
  entityId: Types.ObjectId;
  snapshot: Record<string, unknown>;
  editedBy?: Types.ObjectId;
  editedAt: Date;
};

// Bookkeeping fields the schema regenerates; never replayed from a snapshot.
const SNAPSHOT_META = ["_id", "__v", "createdAt", "updatedAt"] as const;

/**
 * Creates (id null) or updates a content doc. An update first stores the previous
 * full doc in `revisions`, in the same session when one is given, so a caller's
 * transaction commits or rolls back both writes together.
 */
export async function saveWithRevision<T>(
  model: Model<T>,
  id: string | null,
  data: Partial<T>,
  editedBy: string,
  opts?: SaveOptions,
): Promise<HydratedDocument<T>> {
  const session = opts?.session;
  if (id === null) {
    const created = new model(data);
    return (await created.save({ session })) as HydratedDocument<T>;
  }

  const doc = await model.findById(id, null, { session });
  if (!doc) throw new Error(`${model.modelName} ${id} not found`);

  await Revision.create(
    [
      {
        entityType: model.modelName,
        entityId: doc._id,
        snapshot: doc.toObject({ versionKey: true }),
        editedBy,
        editedAt: new Date(),
      },
    ],
    { session },
  );
  doc.set(data);
  return (await doc.save({ session })) as HydratedDocument<T>;
}

/** Re-applies a stored snapshot through `saveWithRevision`, so the restore is itself revisioned. */
export async function restoreRevision(revisionId: string, editedBy: string): Promise<void> {
  const revision = await Revision.findById(revisionId).lean<RevisionRow | null>();
  if (!revision) throw new Error(`Revision ${revisionId} not found`);

  const model = mongoose.models[revision.entityType];
  if (!model) throw new Error(`Unknown entity type ${revision.entityType}`);

  const data = { ...revision.snapshot };
  for (const key of SNAPSHOT_META) delete data[key];
  await saveWithRevision(model, String(revision.entityId), data, editedBy);
}

/** Revisions of one entity, newest first. */
export async function listRevisions(
  entityType: string,
  entityId: string,
): Promise<{ id: string; editedBy: string; editedAt: Date }[]> {
  const rows = await Revision.find({ entityType, entityId })
    .sort({ editedAt: -1, _id: -1 })
    .lean<RevisionRow[]>();
  return rows.map((row) => ({
    id: String(row._id),
    editedBy: String(row.editedBy),
    editedAt: row.editedAt,
  }));
}
