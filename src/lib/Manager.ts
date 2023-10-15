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
	initialized: boolean = false;
	errored: boolean = false;
	connectionErrors: Error[] = [];
	secondaryConnections: Connection[] = [];
	unsubscribeFromOpLogs: () => void;

	async initialize(args: InitArgs) {
		if (this.initialized)
			throw new Error(
				"Dual writes manager has already been initialized. Please check your source code for duplicate calls."
			);

		if (!args || !args.secondaryConnections)
			throw new Error(
				"Dual writes manager is not passed any secondary connection URIs."
			);

		this.initialized = true;
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
				this.secondaryConnections.push(connectionClass);
			} else {
				// Check for any errors and keep adding them or results to the static connection list.
				this.errored = true;
				this.connectionErrors.push(error as Error);
			}
		}

		if (this.errored) {
			console.error(
				"The following connection errors were received: ",
				this.connectionErrors
			);
			throw new Error("Failed to connect to MongoDB");
		}

		// Setup debug interception
		this.unsubscribeFromOpLogs = onMongoDBWriteEvent(
			async (collectionName, method, ...args) => {
				const opPromises: Promise<any>[] = [];
				for (const connection of this.secondaryConnections) {
					const connectionDb = connection.nativeConnection.db;
					const collectionRef = connectionDb.collection(collectionName);
					opPromises.push(collectionRef?.[method]?.(...args));
				}
				Promise.allSettled(opPromises);
			}
		);
	}

	async terminate() {
		if (!this.initialized) return;

		this.unsubscribeFromOpLogs();

		const closingPromises: Promise<any>[] = [];
		for (const connection of this.secondaryConnections)
			closingPromises.push(connection.nativeConnection.close());

		await Promise.all(closingPromises);

		this.initialized = false;
		this.connectionErrors = [];
		this.errored = false;
		this.secondaryConnections = [];
		this.unsubscribeFromOpLogs();
	}
}

export default new DualMongooseWritesManager();
