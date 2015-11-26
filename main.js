'use strict';

var fs = require( 'fs' );
var path = require( 'path' );
var express = require('express');
var convertImage = require('./convertImage.js');
let Files = require( './files.js' );
let imageCache = require( './imageCache.js' );

var photoDir = path.join( __dirname, 'testphotos' );
var staticDir = path.join( __dirname, 'static' );
let g_files = new Files();

const imagesToCache = 2; // caches 2 images ahead of where user is


// function rotateAndSave( index, rotation ) {
	// var p = g_files.getImage( index );
	// convertImage.rotate( p.path, { rotation: rotation, writeExif: true }, function( err, data, newOrientation ) {
		// g_files.updateOrientation( p.path, newOrientation );
		// let newp = p.path;
		// // let ext = path.extname( p.path );
		// // let fileNoExt = path.basename( p.path, ext );
		// // let newp = path.join( path.dirname( p.path ), fileNoExt + ".new" + ext );
		// fs.writeFile( newp, data, 'binary', function() {
			// console.log( "Written image " + p );
		// } );
	// } );
// }


async function nextRequestProcess( req, res ) {
	//console.log( "req", req.query );
	let forwards = true;
	var reqIndex = parseInt( req.query.next.index, 10 );
	console.log( "reqIndex", reqIndex );
	
	// save previous image if modified
	if ( req.query.previous ) {
		let index = parseInt( req.query.previous.index, 10 );
		if ( Boolean( req.query.previous.deleted ) === true ) {
			console.log( "Deleted", index );
			// TODO: mark for deletion
			g_files.getImage( index ).deleted = true;
		} else if ( req.query.previous.rotation !== undefined ) {
			var rot = parseInt( req.query.previous.rotation, 10 );
			if ( rot !== 0 ) {
				// TODO: mark for rotation
				g_files.getImage( index ).rotation = rot;
			}
		}
		
		forwards = index <= reqIndex;
	}
	
	// then load next image
	let imageData = g_files.getImage( reqIndex );
	let image = await imageCache.loadImage( imageData.path );

	res.send( JSON.stringify( {
		index: reqIndex,
		imageData: imageData,
		data: image
	} ) );

	// then order to cache the next 2 images in the direction we are travelling in
	for ( let i=1; i<=imagesToCache; ++i ) {
		let cacheIndex = reqIndex + ( forwards ? i : -i );
		console.log( "Caching", cacheIndex );
		let cacheData = g_files.getImage( cacheIndex );
		imageCache.loadImage( cacheData.path );
	}
}


function onNextRequest( req, res ) {
	let prom = nextRequestProcess( req, res );
	prom.then( () => {
		
	} );
	prom.catch( ( err ) => {
		console.error( "Error!" );
		console.error( err );
	} );
}


export default async function start() {

	await g_files.init( photoDir );
	var app = express();
	app.use( express.static( staticDir ) );
	app.get('/next', onNextRequest );
	
	// cache first images
	for ( let i=-imagesToCache; i<=imagesToCache; ++i ) {
		let cacheIndex = i;
		console.log( "Caching", cacheIndex );
		let cacheData = g_files.getImage( cacheIndex );
		imageCache.loadImage( cacheData.path );
	}

	var server = app.listen(3000, function () {
		var host = server.address().address;
		var port = server.address().port;

		console.log('Listening at http://%s:%s', host, port);
	});
}

