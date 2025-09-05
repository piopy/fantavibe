import fetch from "node-fetch";

export async function handler(event, context) {
	const url = process.env.DIRECT_FILE_URL || "";

	const response = await fetch(url, {
		method: "GET",
		headers: {
			Accept:
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				"User-Agent": "FantaVibe-App",
				"Access-Control-Allow-Origin": "*",
		},
	});

	const data = await response.text();

	return {
		statusCode: 200,
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
		},
		body: data,
	};
}
