require('dotenv').config();
const express = require('express');
const md5 = require('md5');
const api = require('axios');
const bodyParser = require('body-parser');
const app = express();
const mergeImages = require('merge-images-v2');
const Canvas = require('canvas');
const Jimp = require('jimp');
const knex = require('knex')({
	client: 'mysql',
	connection: {
		host : process.env.DB_HOST,
		user : process.env.DB_USERNAME,
		password : process.env.DB_PASSWORD,
		database : process.env.DB_DATABASE
	}
});

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/fn', function(request, response) {
	response.sendFile(__dirname + '/public/index.html');
});

app.post('/fn/generate', function(request, response){
	let keys = Object.keys(request.body).filter(item => item !== "size");
	let size = request.body.size;
	let str = "";

	keys.forEach(function(key, index, array){
		if(index === array.length - 1) {
			str += key + "=" + request.body[key]
		} else {
			str += key + "=" + request.body[key] + ";"
		}
	});

	let hash = md5(str);

	knex.transaction(trx => {
		return trx("items").where("hash", hash).then(res => {
			if(res.length === 0) {
				return trx("items").insert({hash: hash, list: str}).then((row) => {
					return trx("items").where("hash", hash);
				});
			} else {
				return res;
			}
		});
	}).then(res => {
		response.redirect("https://m4st3rx.com/fn/set/"+hash+"?size="+size);
	});
});

app.get('/fn/set/:hash', function(request, response){
	let start = new Date()
	let types = [];

	knex("items").where("hash", request.params.hash).then(res => {
		if(res.length === 0) {
			response.send("This item is not found.")
		} else {
			let items =  res[0].list.split(';')

			items.forEach(function(item){
				let itemParts = item.split('=')

				if(itemParts[1] !== "") {
					types.push(getMainImage(itemParts[0], itemParts[1]))
				}
			})

			Object.keys(request.query).forEach((key) => {
				if(key === "size" || request.query[key] === "") return;
				types.push(getMainImage(key, request.query[key]))
			});

			Promise.all(types)
				.then(function (values) {
					let images = [];
					let size = (values.length < 2) ? values.length : 2;
					if(request.query.size !== undefined && request.query.size !== "") {
						size = (values.length < parseInt(request.query.size)) ? values.length : request.query.size
					}

					let space = 20;
					let width = (256 * size) + (space * (size - 1));
					let height = (256 * Math.ceil(values.length/size)) + (space * (Math.ceil(values.length / size) - 1));

					values.forEach(function(resp, index, originalArr){
						if(resp.data.status !== 200) throw new Error("Error occured");
						if(resp.data.data.length < 1) throw new Error("\"" + resp.data.query.search + "\" item not found");
						let input = resp.data.data[0].images.icon;
						let period = input.lastIndexOf('.');

						Promise.all([getImage(rarityImage(resp.data.data[0].rarity)), getImage(input.substring(0, period) + "_256." + input.substring(period + 1))/*, Jimp.loadFont("")*/])
							.then(function(imgs){
								let x = (index % size !== 0) ? (space + 256) * (index - Math.floor(index/size) * size): 0
								let y = (space + 256) * Math.floor(index/size)

								imgs[0].getBuffer("image/png", (err, buffer) => {
									images.push({
										src: buffer,
										x: x,
										y: y
									});
								});

								//let font = imgs[2];
								let iconImage = imgs[1]

								iconImage.resize(250, 250)/*.print(font, 0, -10, {
								text: resp.data.data[0].price,
								alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
								alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM
								}, iconImage.bitmap.width, iconImage.bitmap.height)*/.getBuffer("image/png", (err, buffer) => {
									images.push({
										src: buffer,
										x: x + 3,
										y: y + 3
									});
								});

								if(originalArr.length === index+1) {
									setTimeout(function(){
										mergeImages(images, { width: width, height: height, Canvas: Canvas }).then(b64 => {
											let img = Buffer.from(b64.split(",")[1], "base64")
											/*Jimp.read(img).then(function(newImage){
											console.log(newImage);
											});*/
											response.writeHead(200, {
												'Content-Type': 'image/png',
												'Content-Length': img.length
											});
											response.end(img);
										}).catch(function(err){
											console.log(err)
										});
									}, 300);
								}
							}).catch(function(err){
								console.log(err)
							});
					});
				}).catch(function(err){
					console.log(err)
				});
		}
	});
});

function rarityImage(rarity){
	switch(rarity) {
		case "legendary":
			return "https://i.imgur.com/Kk41Od4.png";
		case "dark":
			return "https://i.imgur.com/nyMZREC.png";
		case "marvel":
			return "https://i.imgur.com/M6qbwnD.png";
                case "dc":
                        return "https://i.imgur.com/ki45tE3.png";
                case "icon":
                        return "https://i.imgur.com/3Bx9Uxn.png";
		case "epic":
			return "https://i.imgur.com/ZtDyXFL.png";
		case "rare":
			return "https://i.imgur.com/c1WikQq.png";
		case "uncommon":
			return "https://i.imgur.com/3i7Yvz8.png";
		default:
			return "https://i.imgur.com/VvNkRYc.png";
	}
}

function getMainImage(type, search) {
	return api.get("https://fnbr.co/api/images?search=" + search.replace("'", "%27").replace("’", "%E2%80%99") + "&type="+type, {headers: {"x-api-key": "54db1403-f5f6-461a-aa9a-117c4597003b"}});
}

function getImage(img) {
	return Jimp.read(img);
}

const listener = app.listen(3010, function() {
	console.log('Your app is listening on port ' + listener.address().port);
});
