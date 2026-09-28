import { Schema, model, type InferSchemaType } from "mongoose";

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

const todoSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    // Numeric mirror of priority so sorting by priority is meaningful (high > medium > low).
    priorityRank: { type: Number, default: 2, select: false },
    dueDate: { type: Date, default: null },
    tags: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.priorityRank;
        return ret;
      },
    },
  }
);

todoSchema.index({ user: 1, createdAt: -1 });
todoSchema.index({ user: 1, completed: 1 });

export const priorityRank = (p: Priority): number => PRIORITIES.indexOf(p) + 1;

todoSchema.pre("save", function () {
  this.priorityRank = priorityRank(this.priority as Priority);
});

export type TodoAttrs = InferSchemaType<typeof todoSchema>;
export const Todo = model("Todo", todoSchema);
