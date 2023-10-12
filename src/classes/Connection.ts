import type { createConnection } from "mongoose";

type MongooseNativeConnection = Awaited<ReturnType<typeof createConnection>>;

class Connection {
	private mongooseNativeConnection: MongooseNativeConnection;

	constructor(createdConnection: MongooseNativeConnection) {
		this.mongooseNativeConnection = createdConnection;
	}

	public get connectionObject() {
		return this.mongooseNativeConnection;
	}
}

export default Connection;
