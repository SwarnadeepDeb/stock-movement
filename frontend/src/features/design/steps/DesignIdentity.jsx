import { useEffect, useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "react-toastify";

import CustomFormField from "@/components/shared/form/CustomFormField";
import { FormFieldType } from "@/config/FormFieldType";
import JobberSearchInput from "../components/JobberSearchInput";
import QualitySearchInput from "../components/QualitySearchInput";
import PatternSearchInput from "../components/PatternSearchInput";
import ItemNameSelect from "../components/ItemNameSelect";
import { useExistingDesignByCode } from "../hooks/useExistingDesignByCode";

const CODE_CHECK_DEBOUNCE_MS = 400;

// Kept in step with backend design.validator.js and the designs.notes column width.
const NOTES_MAX_LENGTH = 300;

// Max letters + digits in a design code (spaces aren't counted). Kept in step with
// designCodeField in backend design.validator.js.
const DESIGN_CODE_MAX_LENGTH = 30;

const countCodeChars = (code) => code.replace(/ /g, "").length;

// Design codes are lowercase letters and digits in any order (e.g. "kp100", "100kp", "kp100a"),
// optionally split by single spaces (older codes like "kpd 100"). Applied on every keystroke:
// lower-cases, drops anything else, collapses repeated spaces and stops at the length limit.
const formatDesignCode = (raw) => {
  let code = "";

  for (const char of raw.toLowerCase().replace(/\s+/g, " ").replace(/^ /, "")) {
    if (!/[a-z0-9 ]/.test(char)) continue;
    if (char !== " " && countCodeChars(code) >= DESIGN_CODE_MAX_LENGTH) break;
    code += char;
  }

  return code;
};

// Mandatory: blocks the Design Identity step (see DesignSteps) until the code is valid.
const designCodeRules = {
  validate: (value) => {
    const code = (value ?? "").trim();
    if (!code) return "Design Code is required.";
    if (!/^[a-z0-9]+(?: [a-z0-9]+)*$/.test(code) || !/[a-z]/.test(code) || !/[0-9]/.test(code)) {
      return "Design Code must contain both letters and numbers (e.g. kp100).";
    }
    if (countCodeChars(code) > DESIGN_CODE_MAX_LENGTH) return `Design Code must be at most ${DESIGN_CODE_MAX_LENGTH} characters.`;
    return true;
  },
};

const DesignIdentity = ({ control, setExistingDesignByCode, editDesign }) => {
  const codeValue = useWatch({ control, name: "code" });
  const [debouncedCode, setDebouncedCode] = useState("");
  const lastWarnedCode = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedCode(codeValue ?? ""), CODE_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [codeValue]);

  const { data: matchedDesign } = useExistingDesignByCode(debouncedCode);
  // While editing, the design's own code is not a duplicate.
  const existingDesign = matchedDesign && matchedDesign.id !== editDesign?.id ? matchedDesign : null;

  useEffect(() => {
    setExistingDesignByCode?.(existingDesign ?? null);

    if (existingDesign && lastWarnedCode.current !== existingDesign.code) {
      toast.warn(`Design code "${existingDesign.code}" already exists. Wanna continue?`);
      lastWarnedCode.current = existingDesign.code;
    }
  }, [existingDesign, setExistingDesignByCode]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      <ItemNameSelect />
      <div>
        <CustomFormField
          control={control}
          name="code"
          label="Design Code"
          fieldType={FormFieldType.INPUT}
          format={formatDesignCode}
          rules={designCodeRules}
        />
        {existingDesign && (
          <p className="mt-1 text-sm text-amber-600">
            Design code exists, wanna continue?
          </p>
        )}
      </div>
      <JobberSearchInput label="Jobber Name" />
      <PatternSearchInput label="Pattern Name" />
      <QualitySearchInput />
      <CustomFormField
        control={control}
        name="defaultSellingPricePerPiece"
        label="Selling price / piece"
        fieldType={FormFieldType.INPUT}
        inputMode="numeric"
        format={(raw) => raw.replace(/\D/g, "")}
      />
      <div className="md:col-span-2">
        <CustomFormField
          control={control}
          name="notes"
          label="Notes"
          fieldType={FormFieldType.TEXTAREA}
          maxLength={NOTES_MAX_LENGTH}
        />
      </div>
    </div>
  );
};

export default DesignIdentity;
