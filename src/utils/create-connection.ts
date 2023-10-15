import mongoose, { type Connection, type ConnectOptions } from "mongoose";

const createConnection = (connectionURI: string, options?: ConnectOptions) =>
	new Promise<{ result?: Connection; error?: Error }>((resolve) => {
		const connection = mongoose.createConnection(connectionURI, options);
		let returned = false;

		const timeout = setTimeout(
			() =>
				returnConnection({
					error: new Error(
						"Timeout reached for MongoDB connection: 15 seconds"
					),
				}),
			15_000
		);

		const returnConnection = (value: any) => {
			returned = true;
			clearTimeout(timeout);
			resolve(value);
		};

		connection.on("connected", () => returnConnection({ result: connection }));
		connection.on("error", (error) => returnConnection({ error }));
	});

export default createConnection;
