/** Serialize a Mongoose document or lean object to API shape with `id`. */
export function serialize<T extends Record<string, unknown>>(
  doc: T | null | undefined
): (Omit<T, "_id" | "__v"> & { id: string }) | null {
  if (!doc) return null;
  if (typeof (doc as unknown as { toJSON?: () => unknown }).toJSON === "function") {
    return (doc as unknown as { toJSON: () => Omit<T, "_id" | "__v"> & { id: string } }).toJSON();
  }
  const { _id, __v, ...rest } = doc as T & { _id?: string; __v?: number };
  return { id: String(_id), ...rest } as Omit<T, "_id" | "__v"> & { id: string };
}

export function serializeMany<T extends Record<string, unknown>>(docs: T[]) {
  return docs.map((d) => serialize(d)!);
}
