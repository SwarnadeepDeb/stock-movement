import { Controller } from "react-hook-form";

import InputField from "./fields/InputField";
import TextAreaField from "./fields/TextAreaField";
import { FormFieldType } from "@/config/FormFieldType";

// ---- Render Fields ---- //

const RenderFormFields = ({ field, props }) => {
    const { fieldType } = props;

    switch (fieldType) {
        case FormFieldType.INPUT:
            return <InputField key={field.name} {...props} field={field} />

        case FormFieldType.TEXTAREA:
            return <TextAreaField key={field.name} {...props} field={field} />

        // case FormFieldType.MULTIVALUEINPUT:
        //     return <FormMultiValueInput key={field.name} {...props} />

        // case FormFieldType.SELECT:
        //     return <AppSelect key={field.name} field={field}
        //         name={props.name}
        //         label={props.label}
        //         options={props.options ?? []}
        //         placeholder={props.placeholder}
        //         isDisabled={props.disabled} />

        default:
            return null;
    }
};

const CustomFormField = (props) => {
    const { control, fieldType, name, label, rules } = props;

    return (
        <Controller
            control={control}
            name={name}
            rules={rules}
            render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1">
                    {/*{fieldType !== FormFieldType.CHECKBOX && label && ( <label className="text-sm font-regular leading-6 text-[#365486] mb-2">{label}</label>)}*/}

                    <RenderFormFields field={field} props={props} />

                    {fieldState.error && (
                        <p className="text-sm text-[#EA6365] animate-pulse">
                            {/* {fieldState.error.message} */}
                        </p>
                    )}
                </div>
            )}
        />
    );
};

export default CustomFormField;