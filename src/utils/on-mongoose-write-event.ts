import mongoose from "mongoose";

const onMongoDBWriteEvent = (
	callback: (
		collectionName: string,
		methodName: string,
		...methodArgs: any[]
	) => void
) => {
	mongoose.connection.set(
		"debug",
		(
			collectionName: Parameters<typeof callback>[0],
			method: Parameters<typeof callback>[1],
			...args: any[]
		) => {
			if (
				[
					"updateOne",
					"updateMany",
					"insertOne",
					"insertMany",
					"replaceOne",
					"replaceMany",
					"deleteOne",
					"deleteMany",
					"findOneAndUpdate",
					"findOneAndInsert",
					"findOneAndDelete",
					"findOneAndRemove",
					"findOneAndReplace",
				].includes(method)
			)
				callback(collectionName, method, ...args);
		}
	);
	return () => mongoose.connection.set("debug", () => null);
};

export default onMongoDBWriteEvent;
