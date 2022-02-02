const needle = require("needle")
	, cheerio = require("cheerio")
	, { writeFileSync } = require("fs")
	, { Worker } = require("worker_threads");

const CONSTANTS = {
	SCHEMA: "https",
	UESP_DOMAIN: "esoitem.uesp.net",
	UESP_ENDPOINT_DATAVIEWER: "/viewlog.php?record=minedItemSummary",
	TABLE_ROW_INDEX_CHILD: {
		2: "id",
		3: "name",
		5: "description",
		8: "style",
		9: "trait",
		13: "type"
	}
};

const minedItemSummaryURL = `${CONSTANTS.SCHEMA}://${CONSTANTS.UESP_DOMAIN}${CONSTANTS.UESP_ENDPOINT_DATAVIEWER}`;
needle("get", minedItemSummaryURL)
	.then(res =>
	{
		let $overview = cheerio.load(res.body)
			, progText = $overview("p:contains('Displaying ')").text()
			, match = progText.match(/.*Displaying (\d+) of (\d+) records.*/)
			, pageRecords = parseInt(match[1]);
		const totalRecords = parseInt(match[2])
			, totalPages = Math.ceil(totalRecords / pageRecords);

		let requests = 0
			, unsuccessfulRequests = []
			, items = []
			, ITEM_ENTRIES = Object.entries(CONSTANTS.TABLE_ROW_INDEX_CHILD);

		const threadCount = +process.argv[2] || 4;
		const outputFile = process.argv[3] || "items.json";
		const threads = new Set();

		let startPage = 0;
		const range = Math.ceil((totalPages - 0) / threadCount);
		for (let i = 0; i < threadCount; i++)
		{
			const worker = new Worker("./processTable.js", {
				workerData: {
					start: startPage,
					pageRecords, range
				}
			});
			threads.add(worker);

			console.log(`Created a new worker to process pages ${startPage}-${startPage + range}`);
			startPage += range;
		}

		for (const worker of threads)
		{
			worker.on("message", msg =>
			{
				items = items.concat(msg);
			});
			worker.on("exit", () =>
			{
				threads.delete(worker);
				if (threads.size > 0)
					return;

				writeFileSync(outputFile, JSON.stringify(items));
				process.exit();
			});
			worker.on("error", console.error);
		}
	}).catch(console.error);
