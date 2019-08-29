const express = require('express');
const api = require('axios');
const bodyParser = require('body-parser');
const app = express();
const mergeImages = require('merge-images-v2');
const Canvas = require('canvas');
const Jimp = require('jimp');

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get('/set', function(request, response){
  var start = new Date()
  let types = [];
  
  Object.keys(request.query).forEach((key) => {
    if(key == "size" || request.query[key] == "") return;
    types.push(getMainImage(key, request.query[key]))
  });
  
  Promise.all(types)
  .then(function (values) {
    let images = [];
    let size = (values.length < 2) ? values.length : 2;
    if(request.query.size != undefined && request.query.size != "") {
      size = (values.length < parseInt(request.query.size)) ? values.length : request.query.size
    }
    
    let space = 5;
    let width = (256 * size) + (space * (size - 1));
    let height = (256 * Math.ceil(values.length/size)) + (space * (Math.ceil(values.length / size) - 1));
    values.forEach(function(resp, index, originalArr){
      if(resp.data.status != 200) response.end()
      let input = resp.data.data[0].images.icon;
      let period = input.lastIndexOf('.');
      
      Promise.all([getImage(rarityImage(resp.data.data[0].rarity)), getImage(input.substring(0, period) + "_256." + input.substring(period + 1)), Jimp.loadFont("")])
      .then(function(imgs){
        let x = (index % size != 0) ? (space + 256) * (index - Math.floor(index/size) * size): 0
        let y = (space + 256) * Math.floor(index/size)
        
        imgs[0].getBuffer("image/png", (err, buffer) => {
          images.push({
            src: buffer,
            x: x,
            y: y
          });
        });
        
        let font = imgs[2];
        let iconImage = imgs[1]
        
        iconImage.resize(250, 250).print(font, 0, -10, {
          text: resp.data.data[0].price,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
          alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM
        }, iconImage.bitmap.width, iconImage.bitmap.height).getBuffer("image/png", (err, buffer) => {
          images.push({
            src: buffer,
            x: x + 3,
            y: y + 3
          });
        });
        
        if(originalArr.length == index+1) {
          setTimeout(function(){
            mergeImages(images, { width: width, height: height, Canvas: Canvas }).then(b64 => {
              let img = Buffer.from(b64.split(",")[1], "base64")
              Jimp.read(img).then(function(newImage){
                console.log(newImage);
              });
              response.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': img.length
              });
              var end = new Date() - start
              console.info('Execution time: %dms', end)
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
});

function rarityImage(rarity){
  switch(rarity) {
    case "legendary":
      return "https://i.imgur.com/tJ0HWEs.png";
    case "marvel":
      return "https://i.imgur.com/YwuNrCH.png";
    case "epic":
      return "https://i.imgur.com/ZtDyXFL.png";
    case "rare":
      return "https://i.imgur.com/Kv7vz92.png";
    case "uncommon":
      return "https://i.imgur.com/wuvvdwA.png";
    default:
      return "https://i.imgur.com/YVsRyRA.png";
  }
}

function getMainImage(type, search) {
  return api.get("https://fnbr.co/api/images?search=" + search.replace("'", "%E2%80%99").replace("%27", "%E2%80%99") + "&type="+type, {headers: {"x-api-key": process.env.API_KEY}});
}

function getImage(img) {
  return Jimp.read(img);
}

const listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
