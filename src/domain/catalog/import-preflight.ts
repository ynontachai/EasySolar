export type ImportPreflightModelStatus =
  | "NEW_MODEL"
  | "NEW_REVISION"
  | "REVISION_EXISTS"
  | "CATEGORY_CONFLICT";

export interface ExistingImportModel {
  category: "inverter" | "pv_module";
  exactModel: string;
  revisionLabels: string[];
}

export interface ImportPreflightModelResult {
  exactModel: string;
  message: string;
  status: ImportPreflightModelStatus;
}

export interface ExtractedImportPreflightResult {
  canImport: boolean;
  manufacturer: {
    inputName: string;
    matchedName: string | null;
    status: "EXISTING" | "NEW";
  };
  market: string;
  models: ImportPreflightModelResult[];
  revisionLabel: string;
  summary: {
    blocked: number;
    newModels: number;
    newRevisions: number;
  };
}

export function classifyImportModels(input: {
  category: "inverter" | "pv_module";
  exactModels: string[];
  existingModels: ExistingImportModel[];
  revisionLabel: string;
}): ImportPreflightModelResult[] {
  const existingByModel = new Map(
    input.existingModels.map((model) => [model.exactModel.toLocaleLowerCase("en-US"), model]),
  );

  return input.exactModels.map((exactModel) => {
    const existing = existingByModel.get(exactModel.toLocaleLowerCase("en-US"));
    if (!existing) {
      return {
        exactModel,
        message: "จะสร้าง Model ใหม่ภายใต้ Manufacturer นี้",
        status: "NEW_MODEL",
      };
    }
    if (existing.category !== input.category) {
      return {
        exactModel,
        message: "Model นี้มีอยู่แล้วในประเภทอุปกรณ์อื่น",
        status: "CATEGORY_CONFLICT",
      };
    }
    if (existing.revisionLabels.includes(input.revisionLabel)) {
      return {
        exactModel,
        message: `มี Revision ${input.revisionLabel} อยู่แล้ว`,
        status: "REVISION_EXISTS",
      };
    }
    return {
      exactModel,
      message: `จะเพิ่ม Revision ${input.revisionLabel} ใน Model เดิม`,
      status: "NEW_REVISION",
    };
  });
}
