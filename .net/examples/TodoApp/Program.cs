using System.Text.Json;

// ── Startup ──────────────────────────────────────────────────────────────────
var todos = await TodoStorage.LoadAsync();
Console.WriteLine("Todo App — C# Phase 1 Mini-Project");

// ── Main loop ────────────────────────────────────────────────────────────────
while (true)
{
    Console.WriteLine("\n1) List pending   2) List all   3) Add   4) Complete   5) Delete   6) Quit");
    Console.Write("> ");
    var choice = Console.ReadLine()?.Trim();

    switch (choice)
    {
        case "1":
            // LINQ: Where (filter) + OrderBy (sort)
            var pending = todos
                .Where(t => !t.IsCompleted)
                .OrderBy(t => t.CreatedAt)
                .ToList();

            if (pending.Count == 0)
                Console.WriteLine("  No pending todos.");
            else
                foreach (var t in pending)
                    Console.WriteLine($"  [{t.Id}] {t.Title}  ({t.CreatedAt:HH:mm})");
            break;

        case "2":
            // LINQ: Select (map) to a display string
            var all = todos
                .OrderBy(t => t.IsCompleted)
                .ThenBy(t => t.CreatedAt)
                .Select(t => $"  [{t.Id}] {(t.IsCompleted ? "✓" : "○")} {t.Title}")
                .ToList();

            if (all.Count == 0)
                Console.WriteLine("  No todos yet.");
            else
                all.ForEach(Console.WriteLine);
            break;

        case "3":
            Console.Write("  Title: ");
            var title = Console.ReadLine()?.Trim();

            // Null check with pattern matching
            if (string.IsNullOrWhiteSpace(title))
            {
                Console.WriteLine("  Title cannot be empty.");
                break;
            }

            // Records: immutable, created with positional constructor
            var newId = todos.Count == 0 ? 1 : todos.Max(t => t.Id) + 1;
            var newTodo = new Todo(newId, title, false, DateTime.UtcNow);
            todos.Add(newTodo);
            await TodoStorage.SaveAsync(todos);
            Console.WriteLine($"  Added: [{newTodo.Id}] {newTodo.Title}");
            break;

        case "4":
            Console.Write("  ID to complete: ");

            // int.TryParse — safe parse, no exceptions (no JS parseInt weirdness)
            if (!int.TryParse(Console.ReadLine(), out int completeId))
            {
                Console.WriteLine("  Invalid ID.");
                break;
            }

            // FirstOrDefault — like .find(), returns null if not found
            var todoToComplete = todos.FirstOrDefault(t => t.Id == completeId);

            // Pattern matching null check: "is not null"
            if (todoToComplete is null)
            {
                Console.WriteLine("  Todo not found.");
                break;
            }

            // "with" expression — create a new record with one field changed
            // Records are immutable, so we swap the old one for a new one
            todos.Remove(todoToComplete);
            todos.Add(todoToComplete with { IsCompleted = true });
            await TodoStorage.SaveAsync(todos);
            Console.WriteLine($"  Completed: {todoToComplete.Title}");
            break;

        case "5":
            Console.Write("  ID to delete: ");
            if (!int.TryParse(Console.ReadLine(), out int deleteId))
            {
                Console.WriteLine("  Invalid ID.");
                break;
            }

            var todoToDelete = todos.FirstOrDefault(t => t.Id == deleteId);
            if (todoToDelete is null)
            {
                Console.WriteLine("  Todo not found.");
                break;
            }

            todos.Remove(todoToDelete);
            await TodoStorage.SaveAsync(todos);
            Console.WriteLine($"  Deleted: {todoToDelete.Title}");
            break;

        case "6":
            Console.WriteLine("Bye!");
            return;

        default:
            Console.WriteLine("  Unknown option.");
            break;
    }
}

// ── Types ─────────────────────────────────────────────────────────────────────

// record = immutable data object, value equality
// Positional syntax: compiler generates constructor + properties automatically
record Todo(int Id, string Title, bool IsCompleted, DateTime CreatedAt);

// static class = namespace for related functions (no instances)
static class TodoStorage
{
    private const string FilePath = "todos.json";

    // async Task<T> = Promise<T>
    public static async Task<List<Todo>> LoadAsync()
    {
        if (!File.Exists(FilePath))
            return new List<Todo>();

        var json = await File.ReadAllTextAsync(FilePath);

        // ?? = null-coalescing, same as JS ??
        return JsonSerializer.Deserialize<List<Todo>>(json) ?? new List<Todo>();
    }

    public static async Task SaveAsync(List<Todo> todos)
    {
        var options = new JsonSerializerOptions { WriteIndented = true };
        var json = JsonSerializer.Serialize(todos, options);
        await File.WriteAllTextAsync(FilePath, json);
    }
}
