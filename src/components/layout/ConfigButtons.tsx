import { useRef, useState } from "react";
import {
  initialState,
  useAppDispatch,
  useAppState,
} from "../../context/AppContext";
import {
  readConfigFile,
  saveConfigFile,
  CONFIG_EXTENSION,
} from "../../context/configFile";
import { restoreSession } from "../../context/session";
import { buildShareLink } from "../../context/share";

/** Save the whole configuration to a file, open one, or copy a link that reopens it. */
export function ConfigButtons() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(
    null,
  );

  const say = (text: string, bad = false) => {
    setNote({ text, bad });
    window.setTimeout(() => setNote(null), 5000);
  };

  async function open(file: File | undefined) {
    if (!file) return;
    try {
      const raw = await readConfigFile(file);
      dispatch({ type: "loadState", state: restoreSession(raw, initialState) });
      say(`Opened ${file.name}`);
    } catch (e) {
      say(e instanceof Error ? e.message : "Couldn’t open that file.", true);
    }
  }

  async function save() {
    try {
      if (await saveConfigFile(state)) say("Saved");
    } catch {
      say("Couldn’t save the file.", true);
    }
  }

  async function share() {
    try {
      const link = await buildShareLink(state, window.location.href);
      if (link.tooLong)
        return say(
          "This configuration is too big for a link. Use Save instead.",
          true,
        );
      await navigator.clipboard.writeText(link.url);
      say(
        link.droppedImages
          ? `Link copied. ${link.droppedImages} uploaded image${link.droppedImages === 1 ? "" : "s"} can’t travel in a link (use Save).`
          : "Link copied",
      );
    } catch {
      say("Couldn’t copy the link (clipboard blocked).", true);
    }
  }

  return (
    <>
      <div className="seg" role="group" aria-label="Configuration">
        <button
          title="Save this configuration as a file"
          onClick={() => void save()}
        >
          Save
        </button>
        <button
          title="Load a saved configuration"
          onClick={() => input.current?.click()}
        >
          Load
        </button>
        <button
          title="Copy a link that reopens this configuration"
          onClick={() => void share()}
        >
          Share
        </button>
        <input
          ref={input}
          type="file"
          accept={`${CONFIG_EXTENSION},.json,application/json`}
          aria-label="Open configuration file"
          hidden
          onChange={(e) => {
            void open(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {note && (
        <span
          className={note.bad ? "warn" : "muted"}
          role={note.bad ? "alert" : "status"}
        >
          {note.text}
        </span>
      )}
    </>
  );
}
