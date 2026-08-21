import { Schema, SchemaDefinition, SchemaOptions, model, models } from "mongoose";
import { v4 as uuid } from "uuid";

const transform = (_doc: unknown, ret: Record<string, unknown>) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

export function createSchema(definition: SchemaDefinition, options: SchemaOptions = {}): Schema {
  const schema = new Schema(
    {
      _id: { type: String, default: () => uuid() },
      ...definition,
    },
    {
      timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
      ...options,
    }
  );

  schema.set("toJSON", { virtuals: true, versionKey: false, transform });
  schema.set("toObject", { virtuals: true, versionKey: false, transform });
  return schema;
}

export function createSchemaNoUpdateAt(definition: SchemaDefinition, options: SchemaOptions = {}): Schema {
  const schema = new Schema(
    {
      _id: { type: String, default: () => uuid() },
      ...definition,
    },
    {
      timestamps: { createdAt: "createdAt", updatedAt: false },
      ...options,
    }
  );

  schema.set("toJSON", { virtuals: true, versionKey: false, transform });
  schema.set("toObject", { virtuals: true, versionKey: false, transform });
  return schema;
}

/** Hot-reload safe model getter. Returns `any` to avoid Mongoose generic explosion in tsc. */
export function getModel(name: string, schema: Schema, collection: string): any {
  return models[name] ?? model(name, schema, collection);
}
