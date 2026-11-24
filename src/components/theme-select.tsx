"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Folder, FolderOpen, Search } from "lucide-react";

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

const TREE_ROOT_KEY = "__theme-select-root__";

function treeNodeKey(path: string[]) {
  return path.join("\u001f");
}

function flattenVisibleOptionTree(
  nodes: ThemeSelectTreeNode[],
  collapsedNodes: Set<string>,
  parentPath: string[] = [],
): ThemeSelectOption[] {
  return nodes.flatMap((node) => {
    const path = [...parentPath, node.label];
    if (collapsedNodes.has(treeNodeKey(path))) return [];
    return [
      ...flattenVisibleOptionTree(node.children, collapsedNodes, path),
      ...node.options,
    ];
  });
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
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => new Set());
  const selectedOption = options.find((option) => option.value === value);
  const isSearching = Boolean(query.trim());
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
  const hasTreeOptions = Boolean(treeLabel && options.some((option) => option.path?.length));
  const displayedOptions = useMemo(
    () => {
      if (!hasTreeOptions) return filteredOptions;
      if (!isSearching && collapsedNodes.has(TREE_ROOT_KEY)) return [];
      const hiddenNodes = isSearching ? new Set<string>() : collapsedNodes;
      return [...flattenVisibleOptionTree(optionTree.children, hiddenNodes), ...optionTree.options];
    },
    [collapsedNodes, filteredOptions, hasTreeOptions, isSearching, optionTree],
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
    const activeIndex = displayedOptions.findIndex(
      (option) => optionRefs.current.get(option.value) === document.activeElement,
    );
    const selectedIndex = displayedOptions.findIndex((option) => option.value === value);
    const startIndex = activeIndex >= 0 ? activeIndex : Math.max(selectedIndex, 0);
    const nextIndex = (startIndex + direction + displayedOptions.length) % displayedOptions.length;
    optionRefs.current.get(displayedOptions[nextIndex].value)?.focus();
  }

  function toggleNode(key: string) {
    if (isSearching) return;
    setCollapsedNodes((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function choose(nextValue: string) {
    onValueChange?.(nextValue);
    setIsOpen(false);
    setQuery("");
    requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLButtonElement>(".theme-select__trigger")?.focus();
    });
  }
  function renderOption(option: ThemeSelectOption, isTreeOption = false) {
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
            const edgeOption = displayedOptions[event.key === "Home" ? 0 : displayedOptions.length - 1];
            if (edgeOption) optionRefs.current.get(edgeOption.value)?.focus();
          }
        }}
        ref={(element) => {
          if (element) optionRefs.current.set(option.value, element);
          else optionRefs.current.delete(option.value);
        }}
        role={isTreeOption ? "treeitem" : "option"}
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

  function renderTreeNodes(nodes: ThemeSelectTreeNode[], parentPath: string[] = []) {
    return nodes.map((node) => {
      const path = [...parentPath, node.label];
      const key = treeNodeKey(path);
      const isExpanded = isSearching || !collapsedNodes.has(key);
      return (
        <div className="theme-select__tree-branch" key={key}>
          <button
            aria-disabled={isSearching || undefined}
            aria-expanded={isExpanded}
            aria-selected={false}
            className="theme-select__tree-heading"
            onClick={() => toggleNode(key)}
            role="treeitem"
            type="button"
          >
            <ChevronRight aria-hidden="true" className="theme-select__tree-toggle-icon" size={14} />
            {isExpanded ? <FolderOpen aria-hidden="true" size={16} /> : <Folder aria-hidden="true" size={16} />}
            <strong>{node.label}</strong>
          </button>
          {isExpanded ? (
            <div className="theme-select__tree-children" role="group">
              {renderTreeNodes(node.children, path)}
              {node.options.map((option) => renderOption(option, true))}
            </div>
          ) : null}
        </div>
      );
    });
  }

  return (
    <div className="theme-select" data-disabled={disabled || undefined} data-tone={tone} ref={rootRef}>
      {name ? <input name={name} type="hidden" value={value} /> : null}
      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup={hasTreeOptions ? "tree" : "listbox"}
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
            role={hasTreeOptions ? "tree" : "listbox"}
          >
            {hasTreeOptions ? (
              <div className="theme-select__tree-root">
                <button
                  aria-disabled={isSearching || undefined}
                  aria-expanded={isSearching || !collapsedNodes.has(TREE_ROOT_KEY)}
                  aria-selected={false}
                  className="theme-select__tree-root-heading"
                  onClick={() => toggleNode(TREE_ROOT_KEY)}
                  role="treeitem"
                  type="button"
                >
                  <ChevronRight aria-hidden="true" className="theme-select__tree-toggle-icon" size={14} />
                  {isSearching || !collapsedNodes.has(TREE_ROOT_KEY)
                    ? <FolderOpen aria-hidden="true" size={17} />
                    : <Folder aria-hidden="true" size={17} />}
                  <strong>{treeLabel}</strong>
                </button>
                {isSearching || !collapsedNodes.has(TREE_ROOT_KEY) ? (
                  <div className="theme-select__tree-children" role="group">
                    {renderTreeNodes(optionTree.children)}
                    {optionTree.options.map((option) => renderOption(option, true))}
                  </div>
                ) : null}
              </div>
            ) : filteredOptions.map((option) => renderOption(option))}
            {!filteredOptions.length ? <p className="theme-select__empty">{emptyMessage}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
