const needle = require("needle")
	, cheerio = require("cheerio")
	, { Worker, parentPort, workerData } = require("worker_threads");

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

let allItems = [];
function processTable(res)
{
	const $ = cheerio.load(res.body)
		, rows = $("tr").slice(1)
		, items = []
		, ITEM_ENTRIES = Object.entries(CONSTANTS.TABLE_ROW_INDEX_CHILD);

	console.log(`Processing table of ${rows.length} rows`);
	for (const row of rows)
	{
		const $item = $(row)
			, item = {};

		for (const [ x, prop ] of ITEM_ENTRIES)
			item[prop] = $item.find(`td:nth-child(${x})`).text().trim();

		if (item.name === "")
			continue;

		items.push(item);
	}

	return items;
}

(async function()
{
	for (let i = workerData.start; i < workerData.start + workerData.range; i++)
	{
		const url = `${CONSTANTS.SCHEMA}://${CONSTANTS.UESP_DOMAIN}${CONSTANTS.UESP_ENDPOINT_DATAVIEWER}&start=${i * workerData.pageRecords}`
			, res = await needle("get", url);
		allItems = allItems.concat(processTable(res));
	}

	parentPort.postMessage(allItems);
})();
