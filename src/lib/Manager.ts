import {
	type ConnectOptions,
	type Connection as MongooseConnection,
	createConnection,
} from "mongoose";

import Connection from "../classes/Connection";

type InitArgs = {
	connections: {
		uri: string;
		options: ConnectOptions & { enabled?: boolean; primary?: boolean };
	}[];
};

class MultipleConnectionsManager {
	static initialized: boolean = false;
	static errored: boolean = false;
	static connectionErrors: Error[] = [];
	static connections: Connection[] = [];
	static primaryConnection: Connection;

	constructor(args: InitArgs) {
		if (MultipleConnectionsManager.initialized)
			throw new Error(
				"Multiple connections manager has already been initialized. Please check your source code for duplicate calls."
			);

		MultipleConnectionsManager.initialized = true;

		// The connection markes as primary is the one reads happen from.
		const connectionToReadFrom =
			args.connections.find(
				(connection) => connection.options.primary && connection.options.enabled
			) || args.connections[0];

		if (!connectionToReadFrom)
			throw new Error("Primary connection not passed.");

		const connectionPromises: Promise<MongooseConnection>[] = [];
		const enabledConnectionArgs = args.connections.filter(
			(connection) => connection.options.enabled
		);
		for (const connection of enabledConnectionArgs)
			connectionPromises.push(createConnection.apply(null, connection));

		Promise.allSettled(connectionPromises).then((connectionResults) => {
			// Check for any errors and keep adding them or results to the static connection list.
			for (let i = 0; i < connectionResults.length; i++) {
				const result = connectionResults[i];
				const originalConnectionURI = enabledConnectionArgs[i].uri;
				const isReaderConnection =
					originalConnectionURI === connectionToReadFrom.uri;

				if (result.status === "rejected") {
					MultipleConnectionsManager.errored = true;
					MultipleConnectionsManager.connectionErrors.push(result.reason);
				} else {
					const connectionClass = new Connection(result.value);

					MultipleConnectionsManager.connections.push(connectionClass);
					if (isReaderConnection)
						MultipleConnectionsManager.primaryConnection = connectionClass;
				}
			}

			if (MultipleConnectionsManager.errored) {
				console.error(
					"The following connection errors were received: ",
					MultipleConnectionsManager.connectionErrors
				);
				throw new Error("Failed to connect to MongoDB");
			}

			return MultipleConnectionsManager.connections;
		});
	}
}

export default MultipleConnectionsManager;
