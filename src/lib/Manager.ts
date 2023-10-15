import type { ConnectOptions } from "mongoose";

import Connection from "../classes/Connection";

import createConnection from "../utils/create-connection";
import onMongoDBWriteEvent from "../utils/on-mongoose-write-event";

type InitArgs = {
	secondaryConnections: {
		uri: string;
		options?: ConnectOptions & { enabled?: boolean; primary?: boolean };
	}[];
};

class DualMongooseWritesManager {
	static initialized: boolean = false;
	static errored: boolean = false;
	static connectionErrors: Error[] = [];
	static secondaryConnections: Connection[] = [];
	static unsubscribeFromOpLogs: () => void;

	async initialize(args: InitArgs) {
		if (DualMongooseWritesManager.initialized)
			throw new Error(
				"Dual writes manager has already been initialized. Please check your source code for duplicate calls."
			);

		if (!args || !args.secondaryConnections)
			throw new Error(
				"Dual writes manager is not passed any secondary connection URIs."
			);

		DualMongooseWritesManager.initialized = true;
		const parametersForEnabledConnections = args.secondaryConnections.filter(
			(connection) => !connection.options || !connection.options.enabled
		);
		for (const connectionArgs of parametersForEnabledConnections) {
			const { result, error } = await createConnection(
				connectionArgs.uri,
				connectionArgs.options
			);
			if (result) {
				const connectionClass = new Connection(result);
				DualMongooseWritesManager.secondaryConnections.push(connectionClass);
			} else {
				// Check for any errors and keep adding them or results to the static connection list.
				DualMongooseWritesManager.errored = true;
				DualMongooseWritesManager.connectionErrors.push(error as Error);
			}
		}

		if (DualMongooseWritesManager.errored) {
			console.error(
				"The following connection errors were received: ",
				DualMongooseWritesManager.connectionErrors
			);
			throw new Error("Failed to connect to MongoDB");
		}

		// Setup debug interception
		DualMongooseWritesManager.unsubscribeFromOpLogs = onMongoDBWriteEvent(
			async (collectionName, method, ...args) => {
				const opPromises: Promise<any>[] = [];
				for (const connection of DualMongooseWritesManager.secondaryConnections) {
					const connectionDb = connection.nativeConnection.db;
					const collectionRef = connectionDb.collection(collectionName);
					opPromises.push(collectionRef?.[method]?.(...args));
				}
				Promise.allSettled(opPromises);
			}
		);
	}

	async terminate() {
		if (!DualMongooseWritesManager.initialized) return;

		DualMongooseWritesManager.unsubscribeFromOpLogs();

		const closingPromises: Promise<any>[] = [];
		for (const connection of DualMongooseWritesManager.secondaryConnections)
			closingPromises.push(connection.nativeConnection.close());

		await Promise.all(closingPromises);

		DualMongooseWritesManager.initialized = false;
		DualMongooseWritesManager.connectionErrors = [];
		DualMongooseWritesManager.errored = false;
		DualMongooseWritesManager.secondaryConnections = [];
		DualMongooseWritesManager.unsubscribeFromOpLogs();
	}

	get initialized() {
		return DualMongooseWritesManager.initialized;
	}

	get secondaryConnections() {
		return DualMongooseWritesManager.secondaryConnections;
	}

	get errored() {
		return DualMongooseWritesManager.errored;
	}

	get connectionErrors() {
		return DualMongooseWritesManager.connectionErrors;
	}

	get unsubscribeFromOpLogs() {
		return DualMongooseWritesManager.unsubscribeFromOpLogs;
	}
}

export default new DualMongooseWritesManager();
