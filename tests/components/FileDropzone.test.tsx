// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileDropzone, matchesAccept } from "@/components/ui/FileDropzone";

afterEach(cleanup);

const audio = new File(["x"], "a.mp3", { type: "audio/mpeg" });
const png = new File(["x"], "a.png", { type: "image/png" });

describe("matchesAccept", () => {
  it("handles extensions, wildcards, exact types and no list", () => {
    expect(matchesAccept(audio, "audio/*")).toBe(true);
    expect(matchesAccept(png, "audio/*")).toBe(false);
    expect(matchesAccept({ name: "N.MD", type: "" }, ".json,.md")).toBe(true);
    expect(matchesAccept({ name: "g.json", type: "application/json" }, "application/json")).toBe(true);
    expect(matchesAccept(png, undefined)).toBe(true);
  });
});

describe("FileDropzone", () => {
  it("reports files chosen with the picker", () => {
    const onFiles = vi.fn();
    render(<FileDropzone label="Pick" accept="audio/*" onFiles={onFiles} />);
    fireEvent.change(screen.getByLabelText("Pick"), { target: { files: [audio] } });
    expect(onFiles).toHaveBeenCalledWith([audio]);
  });

  it("drops only accepted files and says when it refused one", () => {
    const onFiles = vi.fn();
    render(<FileDropzone label="Pick" accept="audio/*" onFiles={onFiles} />);
    fireEvent.drop(screen.getByLabelText("Pick").closest("label")!, { dataTransfer: { files: [png, audio] } });
    expect(onFiles).toHaveBeenCalledWith([audio]);
    expect(screen.getByRole("alert").textContent).toMatch(/isn't accepted|weren't accepted/);
  });

  it("ignores drops while busy and shows progress", () => {
    const onFiles = vi.fn();
    render(<FileDropzone label="Pick" busy progress={0.4} onFiles={onFiles} />);
    fireEvent.drop(screen.getByLabelText("Pick").closest("label")!, { dataTransfer: { files: [audio] } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
  });

  it("lists files and clears them", () => {
    const onClear = vi.fn();
    render(<FileDropzone label="Pick" files={[{ name: "a.md", size: 2048 }]} onFiles={vi.fn()} onClear={onClear} />);
    expect(screen.getByText("a.md")).toBeTruthy();
    expect(screen.getByText("2 KB")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onClear).toHaveBeenCalled();
  });
});
