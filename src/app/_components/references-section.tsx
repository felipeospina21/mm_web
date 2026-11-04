"use client";

import { parseReferences, MAX_REFERENCES } from "@/lib/references";
import {
  useState,
  useMemo,
  type FC,
  type Dispatch,
  type SetStateAction,
} from "react";

interface ReferencesSectionProps {
  setSubmitted: Dispatch<SetStateAction<string[]>>;
  isFetching: boolean;
}

export const ReferencesSection: FC<ReferencesSectionProps> = ({
  setSubmitted,
  isFetching,
}) => {
  const [input, setInput] = useState("");
  // Live preview of how the current textarea parses (for the counter + the
  // disabled/over-limit state), without triggering a fetch.
  const parsed = useMemo(() => parseReferences(input), [input]);
  const overLimit = parsed.length > MAX_REFERENCES;

  const handleResolve = () => {
    if (parsed.length === 0 || overLimit) return;
    setSubmitted(parsed);
  };

  return (
    <section className="flex flex-col gap-3">
      <label
        htmlFor="references"
        className="text-sm font-semibold text-neutral-800"
      >
        Referencias de productos
      </label>
      <p className="text-sm text-neutral-500">
        Pega una lista de referencias separadas por comas. Buscaremos los
        productos para agregarlos a la cotización.
      </p>
      <textarea
        id="references"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        placeholder="mu-61, te-377, TMPS 234"
        className="focus:ring-primary w-full resize-y rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none focus:border-white focus:ring-1"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`text-xs ${
            overLimit ? "text-red-600" : "text-neutral-400"
          }`}
        >
          {parsed.length === 1
            ? `${parsed.length} referencia`
            : `${parsed.length} referencias`}
        </span>
        <button
          type="button"
          onClick={handleResolve}
          disabled={parsed.length === 0 || overLimit || isFetching}
          className="bg-primary rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isFetching ? "Buscando…" : "Buscar referencias"}
        </button>
      </div>
    </section>
  );
};
