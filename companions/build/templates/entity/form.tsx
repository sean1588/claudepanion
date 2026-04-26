import type { __PASCAL__Input } from "./types";

// TODO(build): replace this placeholder form with real WHERE/WHICH inputs per
// scaffold-spec §16d (form.tsx). One input element per field defined in
// __PASCAL__Input, with appropriate type (text, number, select), client-side
// validation, and a typed onSubmit payload. NOT a "paste your text here" textarea.

interface Props {
  onSubmit: (input: __PASCAL__Input) => void | Promise<void>;
}

export default function __PASCAL__Form({ onSubmit }: Props) {
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit({} as __PASCAL__Input);
  };
  return (
    <form onSubmit={submit} style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
        TODO(build): replace this placeholder form with real input fields per scaffold-spec §16d.
      </p>
      <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>Create</button>
    </form>
  );
}
