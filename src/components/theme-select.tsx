"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, FolderOpen, Search } from "lucide-react";

export interface ThemeSelectOption {
  description?: string;
  label: string;
  path?: string[];
  treeDescription?: string;
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
  searchPlaceholder?: string;
  searchable?: boolean;
  tone?: "ink" | "paper";
  treeLabel?: string;
  value: string;
}

interface ThemeSelectTreeNode {
  children: ThemeSelectTreeNode[];
  label: string;
  options: ThemeSelectOption[];
}

function createOptionTree(options: ThemeSelectOption[]) {
  const root: ThemeSelectTreeNode = { children: [], label: "", options: [] };

  for (const option of options) {
    let parent = root;
    for (const label of option.path ?? []) {
      let node = parent.children.find((candidate) => candidate.label === label);
      if (!node) {
        node = { children: [], label, options: [] };
        parent.children.push(node);
      }
      parent = node;
    }
    parent.options.push(option);
  }

  return root;
}

function flattenOptionTree(nodes: ThemeSelectTreeNode[]): ThemeSelectOption[] {
  return nodes.flatMap((node) => [
    ...flattenOptionTree(node.children),
    ...node.options,
  ]);
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
  searchPlaceholder = "พิมพ์เพื่อค้นหา",
  searchable = false,
  tone = "paper",
  treeLabel,
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
      `${option.path?.join(" ") ?? ""} ${option.label} ${option.description ?? ""} ${option.treeDescription ?? ""}`
        .toLocaleLowerCase("th")
        .includes(normalizedQuery),
    );
  }, [options, query]);
  const optionTree = useMemo(() => createOptionTree(filteredOptions), [filteredOptions]);
  const hasTreeOptions = Boolean(treeLabel && filteredOptions.some((option) => option.path?.length));
  const displayedOptions = useMemo(
    () => hasTreeOptions
      ? [...flattenOptionTree(optionTree.children), ...optionTree.options]
      : filteredOptions,
    [filteredOptions, hasTreeOptions, optionTree],
  );

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
    if (!displayedOptions.length) return;
    const activeIndex = optionRefs.current.findIndex((option) => option === document.activeElement);
    const selectedIndex = displayedOptions.findIndex((option) => option.value === value);
    const startIndex = activeIndex >= 0 ? activeIndex : Math.max(selectedIndex, 0);
    const nextIndex = (startIndex + direction + displayedOptions.length) % displayedOptions.length;
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
  function renderOption(option: ThemeSelectOption, index: number, isTreeOption = false) {
    return (
      <button
        aria-selected={option.value === value}
        className={`theme-select__option${isTreeOption ? " theme-select__tree-option" : ""}`}
        key={option.value}
        onClick={() => choose(option.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            moveFocus(event.key === "ArrowDown" ? 1 : -1);
          }
          if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            optionRefs.current[event.key === "Home" ? 0 : displayedOptions.length - 1]?.focus();
          }
        }}
        ref={(element) => { optionRefs.current[index] = element; }}
        role="option"
        type="button"
      >
        <span>
          <strong>{option.label}</strong>
          {(isTreeOption ? option.treeDescription : option.description) ? (
            <small>{isTreeOption ? option.treeDescription : option.description}</small>
          ) : null}
        </span>
        {option.value === value ? <Check aria-hidden="true" size={17} /> : null}
      </button>
    );
  }

  function renderTreeNodes(nodes: ThemeSelectTreeNode[], optionIndex: { current: number }) {
    return nodes.map((node) => (
      <div className="theme-select__tree-branch" key={node.label} role="group" aria-label={node.label}>
        <div aria-hidden="true" className="theme-select__tree-heading">
          <FolderOpen aria-hidden="true" size={16} />
          <strong>{node.label}</strong>
        </div>
        <div className="theme-select__tree-children">
          {renderTreeNodes(node.children, optionIndex)}
          {node.options.map((option) => renderOption(option, optionIndex.current++, true))}
        </div>
      </div>
    ));
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
        {selectedOption?.description ? (
          <span className="theme-select__value">
            <strong>{selectedOption.label}</strong>
            <small>{selectedOption.description}</small>
          </span>
        ) : (
          <span>{selectedOption?.label ?? placeholder}</span>
        )}
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
                placeholder={searchPlaceholder}
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
            {hasTreeOptions ? (
              <div className="theme-select__tree-root" role="group" aria-label={treeLabel}>
                <div aria-hidden="true" className="theme-select__tree-root-heading">
                  <FolderOpen aria-hidden="true" size={17} />
                  <strong>{treeLabel}</strong>
                </div>
                <div className="theme-select__tree-children">
                  {renderTreeNodes(optionTree.children, { current: 0 })}
                  {optionTree.options.map((option, index) => renderOption(
                    option,
                    displayedOptions.length - optionTree.options.length + index,
                    true,
                  ))}
                </div>
              </div>
            ) : filteredOptions.map((option, index) => renderOption(option, index))}
            {!filteredOptions.length ? <p className="theme-select__empty">{emptyMessage}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
