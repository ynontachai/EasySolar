"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export interface ThemeSelectOption {
  description?: string;
  label: string;
  value: string;
}

interface ThemeSelectProps {
  disabled?: boolean;
  emptyMessage?: string;
  id?: string;
  name?: string;
  onValueChange?: (value: string) => void;
  options: ThemeSelectOption[];
  placeholder?: string;
  required?: boolean;
  searchable?: boolean;
  tone?: "ink" | "paper";
  value: string;
}

export function ThemeSelect({
  disabled = false,
  emptyMessage = "ไม่พบรายการที่ค้นหา",
  id,
  name,
  onValueChange,
  options,
  placeholder = "เลือกรายการ",
  required = false,
  searchable = false,
  tone = "paper",
  value,
}: ThemeSelectProps) {
  const generatedId = useId();
  const controlId = id ?? `theme-select-${generatedId}`;
  const listboxId = `${controlId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("th");
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""}`
        .toLocaleLowerCase("th")
        .includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>(".theme-select__trigger")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function moveFocus(direction: 1 | -1) {
    if (!filteredOptions.length) return;
    const activeIndex = optionRefs.current.findIndex((option) => option === document.activeElement);
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
    const startIndex = activeIndex >= 0 ? activeIndex : Math.max(selectedIndex, 0);
    const nextIndex = (startIndex + direction + filteredOptions.length) % filteredOptions.length;
    optionRefs.current[nextIndex]?.focus();
  }

  function choose(nextValue: string) {
    onValueChange?.(nextValue);
    setIsOpen(false);
    setQuery("");
    requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLButtonElement>(".theme-select__trigger")?.focus();
    });
  }

  return (
    <div className="theme-select" data-disabled={disabled || undefined} data-tone={tone} ref={rootRef}>
      {name ? <input name={name} type="hidden" value={value} /> : null}
      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-required={required}
        className="theme-select__trigger"
        data-empty={!selectedOption || undefined}
        disabled={disabled}
        id={controlId}
        onClick={() => {
          setIsOpen((current) => !current);
          setQuery("");
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setIsOpen(true);
            requestAnimationFrame(() => moveFocus(event.key === "ArrowDown" ? 1 : -1));
          }
        }}
        role="combobox"
        type="button"
      >
        <span>{selectedOption?.label ?? placeholder}</span>
        <ChevronDown aria-hidden="true" size={19} />
      </button>
      {isOpen ? (
        <div className="theme-select__popover">
          {searchable ? (
            <label className="theme-select__search">
              <Search aria-hidden="true" size={16} />
              <span className="sr-only">ค้นหารายการ</span>
              <input
                autoComplete="off"
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder="พิมพ์เพื่อค้นหา"
                type="search"
                value={query}
              />
            </label>
          ) : null}
          <div
            aria-labelledby={controlId}
            className="theme-select__list"
            id={listboxId}
            role="listbox"
          >
            {filteredOptions.map((option, index) => (
              <button
                aria-selected={option.value === value}
                className="theme-select__option"
                key={option.value}
                onClick={() => choose(option.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    moveFocus(event.key === "ArrowDown" ? 1 : -1);
                  }
                  if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    optionRefs.current[event.key === "Home" ? 0 : filteredOptions.length - 1]?.focus();
                  }
                }}
                ref={(element) => { optionRefs.current[index] = element; }}
                role="option"
                type="button"
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
                {option.value === value ? <Check aria-hidden="true" size={17} /> : null}
              </button>
            ))}
            {!filteredOptions.length ? <p className="theme-select__empty">{emptyMessage}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
