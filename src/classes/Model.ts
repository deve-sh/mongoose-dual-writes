import { Model as MongooseModel, Schema } from "mongoose";
import Manager from "../lib/Manager";

const modifierFunctions = [
	"updateOne",
	"updateMany",
	"insertOne",
	"insertMany",
	"deleteOne",
	"deleteMany",
	"bulkSave",
	"findOneAndUpdate",
	"findOneAndReplace",
	"findOneAndDelete",
	"findByIdAndUpdate",
	"findByIdAndRemove",
	"findByIdAndDelete",
	"createCollection",
	"save",
];

// Supposed to be a drop-in replacement for the `new Model(name, schema)` syntax
function Model(modelName: string, schema: Schema) {
	const models = Manager.connections.map((connection) =>
		connection.nativeConnection.model(modelName, schema)
	);

	const returnObj = {};

	for (const modifierFunc of modifierFunctions) {
		returnObj[modifierFunc] = async (
			...args: MongooseModel<any>[Partial<keyof MongooseModel<any>>][]
		) => {
			// Preferrably create a transaction for each model connection and cancel all transactions if any operation fails.

			const promises: any[] = [];

			for (const model of models) promises.push(model[modifierFunc](...args));
			const result = await Promise.allSettled(promises);

			// const anyOpFailed = result.filter((result) => result.status === "rejected").length > 0;
			// Cancel the entire transaction and throw the error

			return result[0].status === "fulfilled" ? result[0].value : null;
		};
	}

	return returnObj;
}

export default Model;
