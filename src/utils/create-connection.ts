import mongoose, { type ConnectOptions } from "mongoose";

const createConnection = async (
	connectionURI: string,
	options: ConnectOptions
) => {
	try {
		return mongoose.createConnection(connectionURI, options);
	} catch (error) {
		throw error;
	}
};

export default createConnection;
