import { type FieldType } from "#ir/field-type.ts";

export interface IrFieldLike {
  name: string;
  label?: string | undefined;
  type: FieldType;
  required: boolean;
}

export type SlugResolver = (collectionKey: string) => string;

const identitySlug: SlugResolver = (key) => key;

export function payloadField(field: IrFieldLike, slugFor: SlugResolver = identitySlug): Record<string, unknown> {
  return {
    name: field.name,
    ...payloadFieldType(field.type, slugFor),
    ...(field.required ? { required: true } : {}),
    ...(field.label ? { label: field.label } : {}),
  };
}

export function payloadFieldType(type: FieldType, slugFor: SlugResolver = identitySlug): Record<string, unknown> {
  switch (type.type) {
    case "text":
    case "color":
    case "url":
    case "email":
    case "phone":
      return { type: "text" };
    case "richText":
      return { type: "richText" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "checkbox" };
    case "date":
      return { type: "date" };
    case "image":
    case "file":
    case "video":
      return { type: "upload", relationTo: "media" };
    case "option":
      return { type: "select", options: type.values.map((v) => ({ label: v, value: v })) };
    case "reference":
      return { type: "relationship", relationTo: slugFor(String(type.collectionKey)) };
    case "multiReference":
      return { type: "relationship", relationTo: slugFor(String(type.collectionKey)), hasMany: true };
    case "array":
      return { type: "array", fields: [{ name: "item", ...payloadFieldType(type.element, slugFor) }] };
    case "group":
      return {
        type: "group",
        fields: type.fields.map((f) => ({
          name: f.name,
          ...payloadFieldType(f.type, slugFor),
          ...(f.required ? { required: true } : {}),
        })),
      };
    case "unsupported":
      return { type: "text" };
  }
}
