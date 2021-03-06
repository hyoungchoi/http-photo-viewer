let fs = require( 'fs' );
let path = require( 'path' );
let piexifjs = require( 'piexifjs' );
let sharp = require('sharp');
let orientation = require( './orientation.js' );

sharp.cache({file: 0}); // see https://github.com/lovell/sharp/issues/415

const newWidth = 300;
const containHeight = 500;


function calculateNewSize( w, h ) {
	// work out if landscape or portrait
	const isLandscape = w > h;
	const ratio = w / h;
	if ( isLandscape ) {
		return {
			width: 740,
			height: Math.floor( 740 * ( h / w ) )
		};
	} else {
		return {
			width: Math.floor( 560 * ( w / h ) ),
			height: 560
		};
	}
}


function bufferToBase64( format, data ) {
	var prefix = "data:image/" + format + ";base64,";
	var base64 = data.toString('base64');
	var photoData = prefix + base64;
	return photoData;
}


function doSharp( imageFilename, options ) {
	console.log( "Using sharp for image conversion..." );
	return new Promise( ( resolve ) => {
		let image = sharp( imageFilename );
		image.metadata()
			.then(function(data) {
				var dimensions = calculateNewSize( data.width, data.height );
				return image.resize(dimensions.width, dimensions.height)
					.withMetadata()
					.jpeg()
		//			.webp()
					.toBuffer()
					.then( function( data ) {
					//	var photoData = bufferToBase64( "webp", data );
						console.log( "Finished." );
						resolve( Buffer.from( data ) );
					} );
					// .toFile('temp.png')
					// .then( function() {
						// let bin = fs.readFileSync( 'temp.png', 'binary' );
						// resolve( bin );
					// } );
			});
	} );
}


export function clientView( imageFilename, options ) {
	if ( options.noConvert ) {
		let data = fs.readFileSync( imageFilename );
		//return bufferToBase64( 'jpeg', data );
		return Promise.resolve( data );
	} else {
		return doSharp( imageFilename, options );
	}
}


export function rotateExif( data, rotation ) {
	if ( !isFinite( rotation ) || rotation === 0 ) {
		return data;
	}
	while ( rotation < 0 ) {
		rotation += 4;
	}
	rotation %= 4;
	console.log( "Rotating " + rotation );

	let exif = piexifjs.load( data );
	let originalOrientation = 0;
	if ( !exif ) {
		exif = {};
	}
	if ( !exif[ "0th" ] ) {
		exif[ "0th" ] = {};
	}
	if ( isFinite( exif[ "0th" ][ piexifjs.ImageIFD.Orientation ] ) ) {
		originalOrientation = exif[ "0th" ][ piexifjs.ImageIFD.Orientation ];
	}
	let newOrientation = orientation.rotate( originalOrientation, rotation );
	console.log( "Old Orientation=" + originalOrientation + " new=" + newOrientation );
	exif[ "0th" ][ piexifjs.ImageIFD.Orientation ] = newOrientation;
//	console.log( "Outputting exif data " + imageFilename + ".exif" );
//	fs.writeFileSync( imageFilename + ".exif", JSON.stringify( exif, null, 2 ) );	
	let exifBytes = piexifjs.dump( exif );
	data = piexifjs.insert( exifBytes, data );
	return data;
}
