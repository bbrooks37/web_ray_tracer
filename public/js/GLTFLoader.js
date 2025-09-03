/**
 * @author Rich Tibbett / https://github.com/richtr
 * @author mrdoob / http://mrdoob.com/
 * @author WestLangley / http://github.com/WestLangley
 *
 * This loader is based on the glTF 2.0 specification:
 * https://github.com/KhronosGroup/glTF/tree/master/specification/2.0/
 *
 * Files are loaded using THREE.FileLoader.
 *
 * Options:
 * dracoLoader: THREE.DRACOLoader instance to decode Draco compressed meshes.
 * ktx2Loader: THREE.KTX2Loader instance to decode KTX2 compressed textures.
 * meshoptDecoder: MeshoptDecoder module for mesh compression.
 * basisTranscoder: BasisTextureLoader transcoders for Basis Universal supercompressed textures.
 *
 * For example:
 *
 * const loader = new THREE.GLTFLoader();
 * loader.load( 'model.glb', function ( gltf ) {
 *
 * scene.add( gltf.scene );
 *
 * } );
 *
 * If you need to control the loading process:
 *
 * const loader = new THREE.GLTFLoader();
 * loader.load( 'model.gltf', function ( gltf ) {
 *
 * console.log( gltf.scene );
 *
 * }, function ( xhr ) {
 *
 * console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
 *
 * }, function ( error ) {
 *
 * console.error( 'An error happened', error );
 *
 * } );
 */

( function () {

	THREE.GLTFLoader = function ( manager ) {

		THREE.Loader.call( this, manager );

		this.dracoLoader = null;
		this.ktx2Loader = null;
		this.meshoptDecoder = null;

	};

	THREE.GLTFLoader.prototype = Object.assign( Object.create( THREE.Loader.prototype ), {

		constructor: THREE.GLTFLoader,

		load: function ( url, onLoad, onProgress, onError ) {

			const scope = this;

			let resourcePath;

			if ( this.resourcePath !== '' ) {

				resourcePath = this.resourcePath;

			} else if ( this.path !== '' ) {

				resourcePath = this.path;

			} else {

				resourcePath = THREE.LoaderUtils.extractUrlBase( url );

			}

			// Tells the FileLoader to use responseType arraybuffer
			const loader = new THREE.FileLoader( scope.manager );
			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );

			loader.load( url, function ( data ) {

				try {

					scope.parse( data, resourcePath, onLoad, onError );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		},

		setDRACOLoader: function ( dracoLoader ) {

			this.dracoLoader = dracoLoader;
			return this;

		},

		setKTX2Loader: function ( ktx2Loader ) {

			this.ktx2Loader = ktx2Loader;
			return this;

		},

		setMeshoptDecoder: function ( meshoptDecoder ) {

			this.meshoptDecoder = meshoptDecoder;
			return this;

		},

		parse: function ( data, path, onLoad, onError ) {

			let content; // Changed from const to let
			let extensions = {}; // Changed from const to let and initialized

			if ( typeof data === 'string' ) {

				content = data;

			} else {

				const magic = THREE.LoaderUtils.decodeText( new Uint8Array( data, 0, 4 ) );

				if ( magic === BINARY_EXTENSION_HEADER_MAGIC ) {

					try {

						extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = new GLTFBinaryExtension( data );
						content = extensions[ EXTENSIONS.KHR_BINARY_GLTF ].content;

					} catch ( error ) {

						if ( onError ) onError( error );
						return;

					}

				} else {

					content = THREE.LoaderUtils.decodeText( new Uint8Array( data ) );

				}

			}

			const json = JSON.parse( content );

			if ( json.asset === undefined || json.asset.version[ 0 ] < 2 ) {

				if ( onError ) onError( new Error( 'THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.' ) );
				return;

			}

			const parser = new GLTFParser( json, {
				path: path || this.resourcePath || '',
				crossOrigin: this.crossOrigin,
				manager: this.manager,
				dracoLoader: this.dracoLoader,
				ktx2Loader: this.ktx2Loader,
				meshoptDecoder: this.meshoptDecoder
			} );

			parser.parse( onLoad, onError );

		}

	} );

	/* GLTFREGISTRY */

	function GLTFRegistry() {

		let objects = {};

		return	{

			get: function ( key ) {

				return objects[ key ];

			},

			add: function ( key, object ) {

				objects[ key ] = object;

			},

			remove: function ( key ) {

				delete objects[ key ];

			},

			removeAll: function () {

				objects = {};

			}

		};

	}

	/*********************************/
	/********** EXTENSIONS ***********/
	/*********************************/

	const EXTENSIONS = {
		KHR_BINARY_GLTF: 'KHR_binary_glTF',
		KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression',
		KHR_LIGHTS_PUNCTUAL: 'KHR_lights_punctual',
		KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS: 'KHR_materials_pbrSpecularGlossiness',
		KHR_MATERIALS_UNLIT: 'KHR_materials_unlit',
		KHR_TEXTURE_BASISU: 'KHR_texture_basisu',
		KHR_TEXTURE_TRANSFORM: 'KHR_texture_transform',
		KHR_MESH_QUANTIZATION: 'KHR_mesh_quantization',
		EXT_TEXTURE_WEBP: 'EXT_texture_webp',
		EXT_MESH_OPT_COMPRESSION: 'EXT_mesh_opt_compression'
	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_binary_glTF
	 */
	function GLTFBinaryExtension( data ) {

		this.name = EXTENSIONS.KHR_BINARY_GLTF;
		this.content = null;
		this.body = null;

		const headerView = new DataView( data, 0, BINARY_EXTENSION_HEADER_LENGTH );

		this.header = {
			magic: THREE.LoaderUtils.decodeText( new Uint8Array( data.slice( 0, 4 ) ) ),
			version: headerView.getUint32( 4, true ),
			length: headerView.getUint32( 8, true )
		};

		if ( this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC ) {

			throw new Error( 'THREE.GLTFLoader: Unsupported glTF-Binary header.' );

		}

		if ( this.header.version < 2.0 ) {

			throw new Error( 'THREE.GLTFLoader: Legacy glTF-Binary file detected.' );

		}

		const jsonContentLength = headerView.getUint32( 12, true );
		const jsonChunk = new Uint8Array( data, BINARY_EXTENSION_HEADER_LENGTH, jsonContentLength );
		this.content = THREE.LoaderUtils.decodeText( jsonChunk );

		const bodyStart = BINARY_EXTENSION_HEADER_LENGTH + jsonContentLength;
		const bodyLength = this.header.length - bodyStart;
		this.body = data.slice( bodyStart, bodyStart + bodyLength );

	}

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
	 */
	function KHRDracoMeshCompressionExtension() {

		this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;

	}

	KHRDracoMeshCompressionExtension.prototype = {

		constructor: KHRDracoMeshCompressionExtension,

		extendObject: function ( parser, object, dracoExtension ) {

			if ( object.type === 'Mesh' ) {

				const geometry = object.geometry;
				// let material = object.material; // Not used

				if ( dracoExtension.bufferView > - 1 ) {

					// Load Draco compressed geometry from bufferView.
					parser.get( 'bufferView', dracoExtension.bufferView )
						.then( function ( bufferView ) {

							parser.dracoLoader.decodeGeometry( bufferView, dracoExtension.attributes, function ( decodedGeometry ) {

								geometry.copy( decodedGeometry );
								geometry.setAttribute( 'position', new THREE.BufferAttribute( geometry.attributes.position.array, 3 ) );
								geometry.setAttribute( 'normal', new THREE.BufferAttribute( geometry.attributes.normal.array, 3 ) );
								geometry.setAttribute( 'uv', new THREE.BufferAttribute( geometry.attributes.uv.array, 2 ) );

								// TODO: Add support for other attributes (e.g. color, skin indices/weights)
								object.updateMatrix();
								object.updateMatrixWorld();

							} );

						} );

				} else if ( dracoExtension.attributes ) {

					// Load Draco compressed geometry from attributes.
					const attributes = {};
					for ( const attributeId in dracoExtension.attributes ) {

						const attribute = dracoExtension.attributes[ attributeId ];
						attributes[ attributeId ] = parser.get( 'accessor', attribute );

					}

					Promise.all( Object.values( attributes ) )
						.then( function ( resolvedAttributes ) {

							parser.dracoLoader.decodeGeometry( resolvedAttributes, dracoExtension.attributes, function ( decodedGeometry ) {

								geometry.copy( decodedGeometry );
								geometry.setAttribute( 'position', new THREE.BufferAttribute( geometry.attributes.position.array, 3 ) );
								geometry.setAttribute( 'normal', new THREE.BufferAttribute( geometry.attributes.normal.array, 3 ) );
								geometry.setAttribute( 'uv', new THREE.BufferAttribute( geometry.attributes.uv.array, 2 ) );

								// TODO: Add support for other attributes (e.g. color, skin indices/weights)
								object.updateMatrix();
								object.updateMatrixWorld();

							} );

						} );

				}

			}

			return Promise.resolve();

		}

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_lights_punctual
	 */
	function KHRLightsPunctualExtension() {

		this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL;

		this.lights = {};

	}

	KHRLightsPunctualExtension.prototype = {

		constructor: KHRLightsPunctualExtension,

		init: function ( parser ) {

			const extension = parser.json.extensions && parser.json.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ];
			if ( ! extension ) {

				return;

			}

			// Store lights and their properties in a map for lookup
			const lights = extension.lights || [];
			this.lights = lights.map( function ( light ) {

				let threeLight;
				switch ( light.type ) {

					case 'directional':
						threeLight = new THREE.DirectionalLight();
						break;

					case 'point':
						threeLight = new THREE.PointLight();
						break;

					case 'spot':
						threeLight = new THREE.SpotLight();
						break;

					default:
						threeLight = new THREE.Light(); // Fallback
						break;

				}

				Object.assign( threeLight, light );

				return threeLight;

			} );

		},

		extendObject: function ( parser, object, lightIndex ) {

			const threeLight = this.lights[ lightIndex ];

			object.add( threeLight );

			return Promise.resolve();

		}

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness
	 */
	function KHRMaterialsPbrSpecularGlossinessExtension() {

		this.name = EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS;

	}

	KHRMaterialsPbrSpecularGlossinessExtension.prototype = {

		constructor: KHRMaterialsPbrSpecularGlossinessExtension,

		extendMaterial: function ( parser, material, extension ) {

			const specularMapRetriever = parser.get( 'texture', extension.specularGlossinessTexture );

			return Promise.all( [ specularMapRetriever ] )
				.then( function ( textures ) {

					const specularMap = textures[ 0 ];

					material.specularGlossinessMap = specularMap;

					if ( extension.specularFactor !== undefined ) {

						material.specular = new THREE.Color().fromArray( extension.specularFactor );

					}

					if ( extension.glossinessFactor !== undefined ) {

						material.glossiness = extension.glossinessFactor;

					}

					material.defines.USE_PBR_SPECULAR_GLOSSINESS = '';

					return material;

				} );

		}

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit
	 */
	function KHRMaterialsUnlitExtension() {

		this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;

	}

	KHRMaterialsUnlitExtension.prototype = {

		constructor: KHRMaterialsUnlitExtension,

		extendMaterial: function ( parser, material, extension ) {

			material.color = new THREE.Color( 0xFFFFFF );
			material.map = null;
			material.lightMap = null;
			material.aoMap = null;
			material.emissiveMap = null;
			material.bumpMap = null;
			material.normalMap = null;
			material.displacementMap = null;
			material.roughnessMap = null;
			material.metalnessMap = null;
			material.alphaMap = null;
			material.envMap = null;

			material.flatShading = true;
			material.needsUpdate = true;

			return Promise.resolve( material );

		}

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_basisu
	 */
	function KHRTextureBasisuExtension() {

		this.name = EXTENSIONS.KHR_TEXTURE_BASISU;

	}

	KHRTextureBasisuExtension.prototype = {

		constructor: KHRTextureBasisuExtension,

		extendTexture: function ( parser, texture, extension ) {

			const source = parser.json.images[ extension.source ];
			const loader = parser.ktx2Loader;

			if ( loader === null ) {

				throw new Error( 'THREE.GLTFLoader: KHR_texture_basisu extension requires THREE.KTX2Loader.' );

			}

			return loader.loadAsync( parser.get( 'bufferView', source.bufferView ) )
				.then( function ( threeTexture ) {

					threeTexture.flipY = false; // KTX2 is always flipY false

					return threeTexture;

				} );

		}

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_transform
	 */
	function KHRTextureTransformExtension() {

		this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM;

	}

	KHRTextureTransformExtension.prototype = {

		constructor: KHRTextureTransformExtension,

		extendTexture: function ( parser, texture, extension ) {

			texture.offset.fromArray( extension.offset );
			texture.repeat.fromArray( extension.scale );
			texture.rotation = extension.rotation;
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;

			return Promise.resolve( texture );

		}

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Ext/EXT_texture_webp
	 */
	function EXTTextureWebPExtension() {

		this.name = EXTENSIONS.EXT_TEXTURE_WEBP;

	}

	EXTTextureWebPExtension.prototype = {

		constructor: EXTTextureWebPExtension,

		extendTexture: function ( parser, texture, extension ) {

			const source = parser.json.images[ extension.source ];
			texture.source = parser.get( 'image', source );

			return Promise.resolve( texture );

		}

	};

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Ext/EXT_mesh_opt_compression
	 */
	function EXTMeshoptCompressionExtension() {

		this.name = EXTENSIONS.EXT_MESH_OPT_COMPRESSION;

	}

	EXTMeshoptCompressionExtension.prototype = {

		constructor: EXTMeshoptCompressionExtension,

		extendObject: function ( parser, object, meshoptExtension ) {

			if ( parser.meshoptDecoder === null ) {

				throw new Error( 'THREE.GLTFLoader: EXT_mesh_opt_compression extension requires MeshoptDecoder.' );

			}

			const bufferViewRetriever = parser.get( 'bufferView', meshoptExtension.bufferView );

			return Promise.all( [ bufferViewRetriever ] )
				.then( function ( bufferViews ) {

					const bufferView = bufferViews[ 0 ];

					const byteOffset = meshoptExtension.byteOffset || 0;
					const byteLength = meshoptExtension.byteLength || 0;

					const count = meshoptExtension.count;
					const stride = meshoptExtension.byteStride;

					const result = new Uint8Array( count * stride );
					parser.meshoptDecoder.decode( result, bufferView, byteOffset, byteLength, count, stride, meshoptExtension.mode );

					// TODO: Handle other attributes
					object.geometry.setAttribute( 'position', new THREE.BufferAttribute( result, 3 ) );

					return object;

				} );

		}

	};

	/*********************************/
	/********** INTERNALS ************/
	/*********************************/

	/* CONSTANTS */

	const WEBGL_CONSTANTS = {
		FLOAT: 5126,
		FLOAT_VEC2: 35664,
		FLOAT_VEC3: 35665,
		FLOAT_VEC4: 35666,
		INT: 5124,
		INT_VEC2: 35667,
		INT_VEC3: 35668,
		INT_VEC4: 35669,
		UNSIGNED_BYTE: 5121,
		UNSIGNED_SHORT: 5123,
		UNSIGNED_INT: 5125,
		BOOL: 35670,
		BOOL_VEC2: 35671,
		BOOL_VEC3: 35672,
		BOOL_VEC4: 35673,
		SAMPLER_2D: 35678,
		SAMPLER_CUBE: 35680
	};

	const ATTRIBUTES = {
		POSITION: 'position',
		NORMAL: 'normal',
		TANGENT: 'tangent',
		TEXCOORD_0: 'uv',
		TEXCOORD_1: 'uv2',
		COLOR_0: 'color',
		JOINTS_0: 'skinIndex',
		WEIGHTS_0: 'skinWeight'
	};

	const PATH_PROPERTIES = {
		scale: 'scale',
		rotation: 'quaternion',
		translation: 'position',
		weights: 'morphTargetInfluences'
	};

	const INTERPOLATION_METHODS = {
		LINEAR: THREE.InterpolateLinear,
		STEP: THREE.InterpolateDiscrete,
		CUBICSPLINE: THREE.InterpolateSmooth
	};

	// const STATES_ENABLES = { // Not used
	// 	2884: 'CULL_FACE',
	// 	2929: 'DEPTH_TEST',
	// 	3042: 'BLEND',
	// 	3089: 'SCISSOR_TEST',
	// 	32823: 'POLYGON_OFFSET_FILL',
	// 	32926: 'SAMPLE_ALPHA_TO_COVERAGE',
	// 	32928: 'SAMPLE_COVERAGE'
	// };

	const ALPHA_MODES = {
		OPAQUE: 'OPAQUE',
		MASK: 'MASK',
		BLEND: 'BLEND'
	};

	// const MIME_TYPE_FORMATS = { // Not used
	// 	'image/png': THREE.RGBAFormat,
	// 	'image/jpeg': THREE.RGBFormat
	// };

	const BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
	const BINARY_EXTENSION_HEADER_LENGTH = 12;
	// const JSON_CHUNK_TYPE = 0x4E4F434E; // Not used
	// const BIN_CHUNK_TYPE = 0x004E4942; // Not used

	// Punctual Lights
	// const LIGHT_TYPE_MAP = { // Not used
	// 	directional: THREE.DirectionalLight,
	// 	point: THREE.PointLight,
	// 	spot: THREE.SpotLight
	// };

	/* UTILITY FUNCTIONS */

	function resolveURL( url, path ) {

		// Invalid URL
		if ( typeof url !== 'string' || url === '' ) {

			return '';

		}

		// Absolute URL
		if ( /^https?:\/\//i.test( url ) ) {

			return url;

		}

		// Data URI
		if ( /^data:.*,.*$/i.test( url ) ) {

			return url;

		}

		// Relative URL
		return path + url;

	}

	const defaultMaterial = new THREE.MeshStandardMaterial( { color: 0xFFFFFF, roughness: 0.8, metalness: 0.2 } );

	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
	 */
	function createDefaultMaterial() {

		return defaultMaterial;

	}

	/* GLTF PARSER */

	function GLTFParser( json = {}, options = {} ) {

		this.json = json;
		this.options = options;
		this.extensions = {};
		this.associations = new Map();

		// internal collections
		this.buffers = new GLTFRegistry();
		this.bufferViews = new GLTFRegistry();
		this.accessors = new GLTFRegistry();
		this.textures = new GLTFRegistry();
		this.images = new GLTFRegistry();
		this.materials = new GLTFRegistry();
		this.cameras = new GLTFRegistry();
		this.nodes = new GLTFRegistry();
		this.meshes = new GLTFRegistry();
		this.skins = new GLTFRegistry();
		this.animations = new GLTFRegistry();
		this.scenes = new GLTFRegistry();

		// loader extensions
		this.extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = json.extensions && json.extensions[ EXTENSIONS.KHR_BINARY_GLTF ] ? new GLTFBinaryExtension( options.data ) : null;
		this.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ] = new KHRDracoMeshCompressionExtension();
		this.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ] = new KHRLightsPunctualExtension();
		this.extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ] = new KHRMaterialsPbrSpecularGlossinessExtension();
		this.extensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ] = new KHRMaterialsUnlitExtension();
		this.extensions[ EXTENSIONS.KHR_TEXTURE_BASISU ] = new KHRTextureBasisuExtension();
		this.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] = new KHRTextureTransformExtension();
		this.extensions[ EXTENSIONS.EXT_TEXTURE_WEBP ] = new EXTTextureWebPExtension();
		this.extensions[ EXTENSIONS.EXT_MESH_OPT_COMPRESSION ] = new EXTMeshoptCompressionExtension();

	}

	GLTFParser.prototype = {

		constructor: GLTFParser,

		/**
		 * Parses a glTF asset.
		 * @param {function(THREE.GLTF):void} onLoad
		 * @param {function(Error):void} onError
		 */
		parse: function ( onLoad, onError ) {

			const parser = this;
			const json = this.json;

			// Clear the registry to avoid a memory leak
			this.resources = new GLTFRegistry();

			// Clear the associations map
			this.associations.clear();

			// KHR_lights_punctual
			this.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ].init( this );

			// Load all resources concurrently.
			const sections = [
				this.get( 'scene' ),
				this.get( 'nodes' ),
				this.get( 'meshes' ),
				this.get( 'accessors' ),
				this.get( 'bufferViews' ),
				this.get( 'buffers' ),
				this.get( 'materials' ),
				this.get( 'images' ),
				this.get( 'textures' ),
				this.get( 'animations' ),
				this.get( 'cameras' )
			];

			Promise.all( sections )
				.then( function ( ) {

					const gltf = {
						scene: json.scene !== undefined ? parser.get( 'scene', json.scene ) : null,
						scenes: parser.scenes.objects,
						cameras: parser.cameras.objects,
						animations: parser.animations.objects,
						nodes: parser.nodes.objects,
						materials: parser.materials.objects,
						meshes: parser.meshes.objects,
						skins: parser.skins.objects,
						textures: parser.textures.objects,
						images: parser.images.objects,
						buffers: parser.buffers.objects,
						bufferViews: parser.bufferViews.objects,
						accessors: parser.accessors.objects,
						parser: parser
					};

					onLoad( new THREE.GLTF( gltf ) );

				} )
				.catch( onError );

		},

		/**
		 * Requests the specified resource ID from the glTF asset.
		 * @param {string} type
		 * @param {number} id
		 * @return {Promise<Object>}
		 */
		get: function ( type, id ) {

			const parser = this;
			const registry = this[ type + 's' ];
			const json = this.json;

			if ( id === undefined || id === null ) {

				return Promise.resolve( null );

			}

			if ( registry.get( id ) ) {

				return registry.get( id );

			}

			const resource = json[ type ][ id ];
			const resourceRetriever = this.loadResource( type, resource );

			registry.add( id, resourceRetriever );

			return resourceRetriever;

		},

		/**
		 * Loads a glTF resource.
		 * @param {string} type
		 * @param {Object} resource
		 * @return {Promise<Object>}
		 */
		loadResource: function ( type, resource ) {

			const parser = this;
			// const options = this.options; // Not used

			switch ( type ) {

				case 'scene':
					return this.loadScene( resource );

				case 'node':
					return this.loadNode( resource );

				case 'mesh':
					return this.loadMesh( resource );

				case 'accessor':
					return this.loadAccessor( resource );

				case 'bufferView':
					return this.loadBufferView( resource );

				case 'buffer':
					return this.loadBuffer( resource );

				case 'material':
					return this.loadMaterial( resource );

				case 'image':
					return this.loadImage( resource );

				case 'texture':
					return this.loadTexture( resource );

				case 'animation':
					return this.loadAnimation( resource );

				case 'camera':
					return this.loadCamera( resource );

				case 'skin':
					return this.loadSkin( resource ); // Added for completeness

			}

		},

		/**
		 * Loads a glTF scene.
		 * @param {Object} scene
		 * @return {Promise<THREE.Scene>}
		 */
		loadScene: function ( scene ) {

			const parser = this;
			const nodes = scene.nodes || [];
			const threeScene = new THREE.Scene();

			return Promise.all( nodes.map( function ( nodeIndex ) {

				return parser.get( 'node', nodeIndex );

			} ) )
				.then( function ( threeNodes ) {

					threeNodes.forEach( function ( threeNode ) {

						threeScene.add( threeNode );

					} );

					return threeScene;

				} );

		},

		/**
		 * Loads a glTF node.
		 * @param {Object} node
		 * @return {Promise<THREE.Object3D>}
		 */
		loadNode: function ( node ) {

			const parser = this;
			const threeNode = new THREE.Object3D();

			if ( node.name !== undefined ) {

				threeNode.name = node.name;

			}

			if ( node.matrix !== undefined ) {

				threeNode.matrix.fromArray( node.matrix );
				threeNode.matrix.decompose( threeNode.position, threeNode.quaternion, threeNode.scale );

			} else {

				if ( node.translation !== undefined ) {

					threeNode.position.fromArray( node.translation );

				}

				if ( node.rotation !== undefined ) {

					threeNode.quaternion.fromArray( node.rotation );

				}

				if ( node.scale !== undefined ) {

					threeNode.scale.fromArray( node.scale );

				}

			}

			if ( node.camera !== undefined ) {

				parser.get( 'camera', node.camera )
					.then( function ( camera ) {

						threeNode.add( camera );

					} );

			}

			if ( node.skin !== undefined ) {

				parser.get( 'skin', node.skin )
					.then( function ( skin ) {

						threeNode.skin = skin;

					} );

			}

			if ( node.mesh !== undefined ) {

				parser.get( 'mesh', node.mesh )
					.then( function ( mesh ) {

						threeNode.add( mesh );

					} );

			}

			if ( node.extensions !== undefined ) {

				for ( const extensionName in node.extensions ) {

					const extension = parser.extensions[ extensionName ];
					if ( extension && extension.extendObject ) {

						extension.extendObject( parser, threeNode, node.extensions[ extensionName ] );

					}

				}

			}

			// Children
			const children = node.children || [];
			const childrenPromises = children.map( function ( childIndex ) {

				return parser.get( 'node', childIndex );

			} );

			return Promise.all( childrenPromises )
				.then( function ( threeChildren ) {

					threeChildren.forEach( function ( threeChild ) {

						threeNode.add( threeChild );

					} );

					return threeNode;

				} );

		},

		/**
		 * Loads a glTF mesh.
		 * @param {Object} mesh
		 * @return {Promise<THREE.Mesh>}
		 */
		loadMesh: function ( mesh ) {

			const parser = this;
			const primitives = mesh.primitives || [];

			const meshes = [];

			for ( let i = 0, il = primitives.length; i < il; i ++ ) {

				const primitive = primitives[ i ];

				const geometry = new THREE.BufferGeometry();

				// Attributes
				const attributes = primitive.attributes;
				for ( const attributeId in attributes ) {

					const attribute = attributes[ attributeId ];
					const attributeName = ATTRIBUTES[ attributeId ] || attributeId;

					parser.get( 'accessor', attribute )
						.then( function ( accessor ) {

							geometry.setAttribute( attributeName, accessor );

						} );

				}

				// Indices
				if ( primitive.indices !== undefined ) {

					parser.get( 'accessor', primitive.indices )
						.then( function ( accessor ) {

							geometry.setIndex( accessor );

						} );

				}

				// Material
				const materialRetriever = primitive.material === undefined ?
					Promise.resolve( createDefaultMaterial() ) : // Changed from create => ( parser.json.materials[ 0 ] )
					parser.get( 'material', primitive.material );

				materialRetriever
					.then( function ( material ) {

						const mesh = new THREE.Mesh( geometry, material );

						if ( mesh.isSkinnedMesh ) {

							// TODO: Add support for skinned meshes
							console.warn( 'THREE.GLTFLoader: Skinned meshes are not yet supported.' );

						}

						meshes.push( mesh );

					} );

			}

			return Promise.all( meshes )
				.then( function ( threeMeshes ) {

					if ( threeMeshes.length === 1 ) {

						return threeMeshes[ 0 ];

					}

					const group = new THREE.Group();

					threeMeshes.forEach( function ( threeMesh ) {

						group.add( threeMesh );

					} );

					return group;

				} );

		},

		/**
		 * Loads a glTF accessor.
		 * @param {Object} accessor
		 * @return {Promise<THREE.BufferAttribute>}
		 */
		loadAccessor: function ( accessor ) {

			const parser = this;
			const bufferViewRetriever = parser.get( 'bufferView', accessor.bufferView );

			return bufferViewRetriever
				.then( function ( bufferView ) {

					const itemSize = WEBGL_CONSTANTS[ accessor.type ];
					const TypedArray = getTypedArray( accessor.componentType ); // Using helper function

					const buffer = bufferView.buffer;
					const byteOffset = bufferView.byteOffset + ( accessor.byteOffset || 0 );

					const array = new TypedArray( buffer, byteOffset, accessor.count * itemSize );
					const threeBufferAttribute = new THREE.BufferAttribute( array, itemSize );

					if ( accessor.normalized === true ) {

						threeBufferAttribute.normalized = true;

					}

					return threeBufferAttribute;

				} );

		},

		/**
		 * Loads a glTF bufferView.
		 * @param {Object} bufferView
		 * @return {Promise<Object>}
		 */
		loadBufferView: function ( bufferView ) {

			const parser = this;
			const bufferRetriever = parser.get( 'buffer', bufferView.buffer );

			return bufferRetriever
				.then( function ( buffer ) {

					const byteLength = bufferView.byteLength || 0;
					const byteOffset = bufferView.byteOffset || 0;

					return {
						buffer: buffer,
						byteLength: byteLength,
						byteOffset: byteOffset
					};

				} );

		},

		/**
		 * Loads a glTF buffer.
		 * @param {Object} buffer
		 * @return {Promise<ArrayBuffer>}
		 */
		loadBuffer: function ( buffer ) {

			const parser = this;
			const url = resolveURL( buffer.uri, parser.options.path );
			const loader = new THREE.FileLoader( parser.manager );

			loader.setResponseType( 'arraybuffer' );
			loader.setWithCredentials( parser.options.withCredentials );

			return loader.loadAsync( url );

		},

		/**
		 * Loads a glTF material.
		 * @param {Object} material
		 * @return {Promise<THREE.Material>}
		 */
		loadMaterial: function ( material ) {

			const parser = this;
			const threeMaterial = new THREE.MeshStandardMaterial();

			if ( material.name !== undefined ) {

				threeMaterial.name = material.name;

			}

			if ( material.pbrMetallicRoughness !== undefined ) {

				const pbrMetallicRoughness = material.pbrMetallicRoughness;

				if ( pbrMetallicRoughness.baseColorFactor !== undefined ) {

					threeMaterial.color.fromArray( pbrMetallicRoughness.baseColorFactor );

				}

				if ( pbrMetallicRoughness.baseColorTexture !== undefined ) {

					parser.get( 'texture', pbrMetallicRoughness.baseColorTexture.index )
						.then( function ( texture ) {

							threeMaterial.map = texture;

						} );

				}

				if ( pbrMetallicRoughness.metallicFactor !== undefined ) {

					threeMaterial.metalness = pbrMetallicRoughness.metallicFactor;

				}

				if ( pbrMetallicRoughness.roughnessFactor !== undefined ) {

					threeMaterial.roughness = pbrMetallicRoughness.roughnessFactor;

				}

				if ( pbrMetallicRoughness.metallicRoughnessTexture !== undefined ) {

					parser.get( 'texture', pbrMetallicRoughness.metallicRoughnessTexture.index )
						.then( function ( texture ) {

							threeMaterial.metalnessMap = texture;
							threeMaterial.roughnessMap = texture;

						} );

				}

			}

			if ( material.normalTexture !== undefined ) {

				parser.get( 'texture', material.normalTexture.index )
					.then( function ( texture ) {

						threeMaterial.normalMap = texture;

					} );

			}

			if ( material.occlusionTexture !== undefined ) {

				parser.get( 'texture', material.occlusionTexture.index )
					.then( function ( texture ) {

						threeMaterial.aoMap = texture;

					} );

			}

			if ( material.emissiveFactor !== undefined ) {

				threeMaterial.emissive.fromArray( material.emissiveFactor );

			}

			if ( material.emissiveTexture !== undefined ) {

				parser.get( 'texture', material.emissiveTexture.index )
					.then( function ( texture ) {

						threeMaterial.emissiveMap = texture;

					} );

			}

			if ( material.alphaMode !== undefined ) {

				const alphaMode = material.alphaMode;

				if ( alphaMode === ALPHA_MODES.BLEND ) {

					threeMaterial.transparent = true;

				} else if ( alphaMode === ALPHA_MODES.MASK ) {

					threeMaterial.alphaTest = material.alphaCutoff !== undefined ? material.alphaCutoff : 0.5;

				}

			}

			if ( material.doubleSided === true ) {

				threeMaterial.side = THREE.DoubleSide;

			}

			if ( material.extensions !== undefined ) {

				for ( const extensionName in material.extensions ) {

					const extension = parser.extensions[ extensionName ];
					if ( extension && extension.extendMaterial ) {

						extension.extendMaterial( parser, threeMaterial, material.extensions[ extensionName ] );

					}

				}

			}

			return Promise.resolve( threeMaterial );

		},

		/**
		 * Loads a glTF image.
		 * @param {Object} image
		 * @return {Promise<HTMLImageElement|HTMLCanvasElement>}
		 */
		loadImage: function ( image ) {

			const parser = this;
			const url = resolveURL( image.uri, parser.options.path );
			const loader = new THREE.ImageLoader( parser.manager );

			return loader.loadAsync( url );

		},

		/**
		 * Loads a glTF texture.
		 * @param {Object} texture
		 * @return {Promise<THREE.Texture>}
		 */
		loadTexture: function ( texture ) {

			const parser = this;
			const source = parser.json.images[ texture.source ];
			const sampler = parser.json.samplers[ texture.sampler ];

			const textureRetriever = parser.get( 'image', texture.source )
				.then( function ( image ) {

					const threeTexture = new THREE.Texture( image );

					if ( sampler !== undefined ) {

						threeTexture.wrapS = sampler.wrapS;
						threeTexture.wrapT = sampler.wrapT;
						threeTexture.magFilter = sampler.magFilter;
						threeTexture.minFilter = sampler.minFilter;

					}

					threeTexture.needsUpdate = true;

					return threeTexture;

				} );

			return textureRetriever;

		},

		/**
		 * Loads a glTF animation.
		 * @param {Object} animation
		 * @return {Promise<THREE.AnimationClip>}
		 */
		loadAnimation: function ( animation ) {

			const parser = this;
			const channels = animation.channels || [];
			const samplers = animation.samplers || [];

			const clip = new THREE.AnimationClip( animation.name || '', - 1, [] );

			return Promise.all( channels.map( function ( channel ) {

				const sampler = samplers[ channel.sampler ];
				const target = channel.target;
				const node = parser.json.nodes[ target.node ];
				const nodeName = node.name !== undefined ? node.name : target.node;
				const path = PATH_PROPERTIES[ target.path ];
				const inputAccessor = parser.get( 'accessor', sampler.input );
				const outputAccessor = parser.get( 'accessor', sampler.output );

				return Promise.all( [ inputAccessor, outputAccessor ] )
					.then( function ( accessors ) {

						const input = accessors[ 0 ];
						const output = accessors[ 1 ];

						const InterpolantFactoryMethod = INTERPOLATION_METHODS[ sampler.interpolation ];

						const tracks = [];

						if ( path === PATH_PROPERTIES.weights ) {

							// TODO: Add support for morph target animations
							console.warn( 'THREE.GLTFLoader: Morph target animations are not yet supported.' );

						} else {

							tracks.push( new THREE.VectorKeyframeTrack( nodeName + '.' + path, input.array, output.array, InterpolantFactoryMethod ) );

						}

						return tracks;

					} );

			} ) )
				.then( function ( tracks ) {

					tracks.forEach( function ( track ) {

						clip.tracks.push( track );

					} );

					return clip;

				} );

		},

		/**
		 * Loads a glTF camera.
		 * @param {Object} camera
		 * @return {Promise<THREE.Camera>}
		 */
		loadCamera: function ( camera ) {

			let threeCamera;

			if ( camera.type === 'perspective' ) {

				threeCamera = new THREE.PerspectiveCamera(
					THREE.MathUtils.radToDeg( camera.perspective.yfov ),
					camera.perspective.aspectRatio,
					camera.perspective.znear,
					camera.perspective.zfar
				);

			} else if ( camera.type === 'orthographic' ) {

				threeCamera = new THREE.OrthographicCamera(
					camera.orthographic.xmag,
					camera.orthographic.ymag,
					camera.orthographic.znear,
					camera.orthographic.zfar
				);

			}

			return Promise.resolve( threeCamera );

		},

		/**
		 * Loads a glTF skin.
		 * @param {Object} skin
		 * @return {Promise<THREE.Skeleton>}
		 */
		loadSkin: function ( skin ) {

			const parser = this;
			const json = this.json;

			const joints = new Promise( function ( resolve ) {

				const jointNodes = [];
				for ( let i = 0, il = skin.joints.length; i < il; i ++ ) {

					jointNodes.push( parser.get( 'node', skin.joints[ i ] ) );

				}
				Promise.all( jointNodes ).then( resolve );

			} );

			const inverseBindMatrices = parser.get( 'accessor', skin.inverseBindMatrices )
				.then( function ( accessor ) {

					return accessor.array;

				} );

			return Promise.all( [ joints, inverseBindMatrices ] )
				.then( function ( results ) {

					const threeJoints = results[ 0 ];
					const threeInverseBindMatrices = results[ 1 ];

					const skeleton = new THREE.Skeleton( threeJoints, threeInverseBindMatrices );

					return skeleton;

				} );

		}

	};

	/**
	 * Helper function to get the correct TypedArray for a given WebGL component type.
	 * @param {number} componentType - The WebGL component type.
	 * @returns {TypedArrayConstructor} The corresponding TypedArray constructor.
	 */
	function getTypedArray( componentType ) {

		switch ( componentType ) {

			case 5120: return Int8Array;
			case 5121: return Uint8Array;
			case 5122: return Int16Array;
			case 5123: return Uint16Array;
			case 5125: return Uint32Array;
			case 5126: return Float32Array;
			default: throw new Error( 'THREE.GLTFLoader: Unknown component type ' + componentType );

		}

	}

	// GLTF.js is a wrapper for the glTF asset.
	THREE.GLTF = function ( gltf ) {

		Object.assign( this, gltf );

	};

} )();
