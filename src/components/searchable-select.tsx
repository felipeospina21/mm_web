"use client";

import { useEffect, useRef, useState } from "react";

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id: string;
  label: string;
  searchLabel: string;
  noResultsLabel: string;
  options: SearchableSelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  footerAction?: { label: string; onSelect: () => void };
}

export function SearchableSelect({
  id,
  label,
  searchLabel,
  noResultsLabel,
  options,
  value,
  onChange,
  footerAction,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(normalizedSearch),
  );

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const open = () => {
    setSearch("");
    setIsOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-required="true"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-options`}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        className="focus:ring-primary flex w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-sm text-neutral-900 outline-none focus:border-white focus:ring-1"
      >
        <span className={selectedOption ? "" : "text-neutral-500"}>
          {selectedOption?.label ?? label}
        </span>
        <span aria-hidden="true" className="ml-2 text-neutral-500">
          ⌄
        </span>
      </button>
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          <input
            ref={searchRef}
            type="search"
            aria-label={searchLabel}
            placeholder={searchLabel}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full border-b border-neutral-200 px-3 py-2 text-sm outline-none"
          />
          <ul
            id={`${id}-options`}
            role="listbox"
            className="max-h-56 overflow-y-auto p-1"
          >
            {footerAction && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setIsOpen(false);
                    footerAction.onSelect();
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-green-700 hover:bg-green-50"
                >
                  {footerAction.label}
                </button>
              </li>
            )}

            {filteredOptions.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setSearch("");
                    setIsOpen(false);
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-neutral-900 hover:bg-neutral-100"
                >
                  {option.label}
                </button>
              </li>
            ))}
            {filteredOptions.length === 0 && (
              <li className="px-3 py-2 text-sm text-neutral-500">
                {noResultsLabel}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
