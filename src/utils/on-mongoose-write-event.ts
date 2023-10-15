import mongoose from "mongoose";

const onMongoDBWriteEvent = (
	callback: (
		collectionName: string,
		methodName: string,
		...methodArgs: any[]
	) => void
) => mongoose.connection.set("debug", callback);

export default onMongoDBWriteEvent;
