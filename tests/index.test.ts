import mongoose, { type Mongoose } from "mongoose";
import Manager from "../src";

import DummyModel from "./mocks/dummy-model";

let mockMongoObject: Mongoose;

const primaryConnectionURI = globalThis.__MONGO_URI__;
const secondaryConnectionURI = globalThis.__MONGO_URI__ + "replicadb";

const accountForReplicationLag = () =>
	new Promise((resolve) => setTimeout(resolve, 10));

beforeAll(async () => {
	// Create primary database connection.
	mockMongoObject = await mongoose.connect(primaryConnectionURI);
});

describe("Tests for Dual Writes manager for Mongoose", () => {
	afterEach(async () => {
		await Manager.terminate();
	});

	it("should expose a manager class instance", async () => {
		expect(Manager).toBeDefined();
		expect(Manager.initialize).toBeDefined();
		expect(Manager.terminate).toBeDefined();
	});

	it("should throw error on invalid initialization arguments", async () => {
		try {
			// @ts-expect-error testing the error throwing behaviour
			await Manager.initialize();
		} catch (error) {
			expect(error.message).toMatch(
				/Dual writes manager is not passed any secondary connection URIs/i
			);
		}
	});

	it("should throw error if there are more than 1 instances of manager class opened", async () => {
		try {
			await Manager.initialize({ secondaryConnections: [] });
			await Manager.initialize({ secondaryConnections: [] });
		} catch (error) {
			expect(error.message).toMatch(
				/Dual writes manager has already been initialized/i
			);
		}
	});

	it("should connect to secondary db and expose an unsubscriber to op logs", async () => {
		await Manager.initialize({
			secondaryConnections: [{ uri: secondaryConnectionURI }],
		});
		expect(Manager.secondaryConnections.length).toBe(1);
		expect(Manager.unsubscribeFromOpLogs).toBeDefined();
	});

	it("should replicate changes to the secondary database", async () => {
		await Manager.initialize({
			secondaryConnections: [{ uri: secondaryConnectionURI }],
		});

		const query = { data: "Some random value" };

		const DummyData = new DummyModel(query);
		await DummyData.save();

		await accountForReplicationLag();

		// Check if the created collection document was replicated.
		const nativeMongoSecondaryConnection =
			Manager.secondaryConnections[0].nativeConnection;

		const collectionInSecondary =
			nativeMongoSecondaryConnection.collection("dummy-models");
		const replicatedValue = await collectionInSecondary.findOne(query);

		expect(replicatedValue).not.toBeNull();
		expect(replicatedValue?.data).toBe(query.data);
		expect(replicatedValue?._id).toBeDefined();
		expect(replicatedValue?.__v).toBeDefined();

		// Same for deletion of a value
		await DummyModel.deleteOne(query);
		await accountForReplicationLag();

		const deletedValueInSecondary = await collectionInSecondary.findOne(query);
		expect(deletedValueInSecondary).toBeNull();
	});
});

afterAll(async () => {
	await mockMongoObject.connection.close();
});
