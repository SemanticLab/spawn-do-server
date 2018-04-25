const express = require('express')
const app = express()
const request = require('request');


if (!process.env.do_key){
	console.error("No do_key defined")
	process.exit()
}
var token = process.env.do_key
var serverStatus = null


var getDropletId = (callback) =>{
	console.log('yeahh')
	var options = {
	  url: 'https://api.digitalocean.com/v2/droplets?tag_name=nerserver&per_page=1',
	  headers: {
	    "Authorization":"Bearer " + token
	  }
	};

	function callback(error, response, body) {
	  if (!error && response.statusCode == 200) {
	  	try{
		    var info = JSON.parse(body);
		    if (info.droplets.length==0){
		    	serverStatus='down'
		    }
		    console.log(info)	
		}catch(E){
			console.error(E)	
		}
	        
	  }else{
	  	console.error(error,response.statusCode)
	  }
	}


	request(options, callback);



}


app.get('/', (req, res) => res.send('Hello World!'))

app.listen(3000, () => console.log('Example app listening on port 3000!'))

setInterval(getDropletId,15000)
