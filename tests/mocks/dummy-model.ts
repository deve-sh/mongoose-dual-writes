import { model, Schema } from "mongoose";

const DummyModel = model(
    'dummy-model',
	new Schema({ data: { type: String, default: "some value" } })
);

export default DummyModel;
