(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three'), require('three-mesh-bvh')) :
	typeof define === 'function' && define.amd ? define(['exports', 'three', 'three-mesh-bvh'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.ThreBvhCsg = global.ThreBvhCsg || {}, global.THREE, global.MeshBVHLib));
})(this, (function (exports, three, threeMeshBvh) { 'use strict';

	const HASH_WIDTH = 1e-6;
	const HASH_HALF_WIDTH = HASH_WIDTH * 0.5;
	const HASH_MULTIPLIER = Math.pow( 10, - Math.log10( HASH_WIDTH ) );
	const HASH_ADDITION = HASH_HALF_WIDTH * HASH_MULTIPLIER;
	function hashNumber( v ) {

		return ~ ~ ( v * HASH_MULTIPLIER + HASH_ADDITION );

	}

	function hashVertex2( v ) {

		return `${ hashNumber( v.x ) },${ hashNumber( v.y ) }`;

	}

	function hashVertex3( v ) {

		return `${ hashNumber( v.x ) },${ hashNumber( v.y ) },${ hashNumber( v.z ) }`;

	}

	function hashVertex4( v ) {

		return `${ hashNumber( v.x ) },${ hashNumber( v.y ) },${ hashNumber( v.z ) },${ hashNumber( v.w ) }`;

	}

	function hashRay( r ) {

		return `${ hashVertex3( r.origin ) }-${ hashVertex3( r.direction ) }`;

	}

	function toNormalizedRay( v0, v1, target ) {

		// get a normalized direction
		target
			.direction
			.subVectors( v1, v0 )
			.normalize();

		// project the origin onto the perpendicular plane that
		// passes through 0, 0, 0
		const scalar = v0.dot( target.direction );
		target.
			origin
			.copy( v0 )
			.addScaledVector( target.direction, - scalar );

		return target;

	}

	function areSharedArrayBuffersSupported() {

		return typeof SharedArrayBuffer !== 'undefined';

	}

	function convertToSharedArrayBuffer( array ) {

		if ( array.buffer instanceof SharedArrayBuffer ) {

			return array;

		}

		const cons = array.constructor;
		const buffer = array.buffer;
		const sharedBuffer = new SharedArrayBuffer( buffer.byteLength );

		const uintArray = new Uint8Array( buffer );
		const sharedUintArray = new Uint8Array( sharedBuffer );
		sharedUintArray.set( uintArray, 0 );

		return new cons( sharedBuffer );

	}

	function getIndexArray( vertexCount, BufferConstructor = ArrayBuffer ) {

		if ( vertexCount > 65535 ) {

			return new Uint32Array( new BufferConstructor( 4 * vertexCount ) );

		} else {

			return new Uint16Array( new BufferConstructor( 2 * vertexCount ) );

		}

	}

	function ensureIndex( geo, options ) {

		if ( ! geo.index ) {

			const vertexCount = geo.attributes.position.count;
			const BufferConstructor = options.useSharedArrayBuffer ? SharedArrayBuffer : ArrayBuffer;
			const index = getIndexArray( vertexCount, BufferConstructor );
			geo.setIndex( new three.BufferAttribute( index, 1 ) );

			for ( let i = 0; i < vertexCount; i ++ ) {

				index[ i ] = i;

			}

		}

	}

	function getVertexCount( geo ) {

		return geo.index ? geo.index.count : geo.attributes.position.count;

	}

	function getTriCount( geo ) {

		return getVertexCount( geo ) / 3;

	}

	const DEGENERATE_EPSILON = 1e-8;
	const _tempVec = new three.Vector3();

	function toTriIndex( v ) {

		return ~ ~ ( v / 3 );

	}

	function toEdgeIndex( v ) {

		return v % 3;

	}

	function sortEdgeFunc( a, b ) {

		return a.start - b.start;

	}

	function getProjectedDistance( ray, vec ) {

		return _tempVec.subVectors( vec, ray.origin ).dot( ray.direction );

	}

	function hasOverlaps( arr ) {

		arr = [ ...arr ].sort( sortEdgeFunc );
		for ( let i = 0, l = arr.length; i < l - 1; i ++ ) {

			const info0 = arr[ i ];
			const info1 = arr[ i + 1 ];

			if ( info1.start < info0.end && Math.abs( info1.start - info0.end ) > 1e-5 ) {

				return true;

			}

		}

		return false;

	}

	function getEdgeSetLength( arr ) {

		let tot = 0;
		arr.forEach( ( { start, end } ) => tot += end - start );
		return tot;

	}

	function matchEdges( forward, reverse, disjointConnectivityMap, eps = DEGENERATE_EPSILON ) {

		forward.sort( sortEdgeFunc );
		reverse.sort( sortEdgeFunc );

		for ( let i = 0; i < forward.length; i ++ ) {

			const e0 = forward[ i ];
			for ( let o = 0; o < reverse.length; o ++ ) {

				const e1 = reverse[ o ];
				if ( e1.start > e0.end ) {

					// e2 is completely after e1
					// break;

					// NOTE: there are cases where there are overlaps due to precision issues or
					// thin / degenerate triangles. Assuming the sibling side has the same issues
					// we let the matching work here. Long term we should remove the degenerate
					// triangles before this.

				} else if ( e0.end < e1.start || e1.end < e0.start ) {

					// e1 is completely before e2
					continue;

				} else if ( e0.start <= e1.start && e0.end >= e1.end ) {

					// e1 is larger than and e2 is completely within e1
					if ( ! areDistancesDegenerate( e1.end, e0.end ) ) {

						forward.splice( i + 1, 0, {
							start: e1.end,
							end: e0.end,
							index: e0.index,
						} );

					}

					e0.end = e1.start;

					e1.start = 0;
					e1.end = 0;

				} else if ( e0.start >= e1.start && e0.end <= e1.end ) {

					// e2 is larger than and e1 is completely within e2
					if ( ! areDistancesDegenerate( e0.end, e1.end ) ) {

						reverse.splice( o + 1, 0, {
							start: e0.end,
							end: e1.end,
							index: e1.index,
						} );

					}

					e1.end = e0.start;

					e0.start = 0;
					e0.end = 0;

				} else if ( e0.start <= e1.start && e0.end <= e1.end ) {

					// e1 overlaps e2 at the beginning
					const tmp = e0.end;
					e0.end = e1.start;
					e1.start = tmp;

				} else if ( e0.start >= e1.start && e0.end >= e1.end ) {

					// e1 overlaps e2 at the end
					const tmp = e1.end;
					e1.end = e0.start;
					e0.start = tmp;

				} else {

					throw new Error();

				}

				// Add the connectivity information
				if ( ! disjointConnectivityMap.has( e0.index ) ) {

					disjointConnectivityMap.set( e0.index, [] );

				}

				if ( ! disjointConnectivityMap.has( e1.index ) ) {

					disjointConnectivityMap.set( e1.index, [] );

				}

				disjointConnectivityMap
					.get( e0.index )
					.push( e1.index );

				disjointConnectivityMap
					.get( e1.index )
					.push( e0.index );

				if ( isEdgeDegenerate( e1 ) ) {

					reverse.splice( o, 1 );
					o --;

				}

				if ( isEdgeDegenerate( e0 ) ) {

					// and if we have to remove the current original edge then exit this loop
					// so we can work on the next one
					forward.splice( i, 1 );
					i --;
					break;

				}

			}

		}

		cleanUpEdgeSet( forward );
		cleanUpEdgeSet( reverse );

		function cleanUpEdgeSet( arr ) {

			for ( let i = 0; i < arr.length; i ++ ) {

				if ( isEdgeDegenerate( arr[ i ] ) ) {

					arr.splice( i, 1 );
					i --;

				}

			}

		}

		function areDistancesDegenerate( start, end ) {

			return Math.abs( end - start ) < eps;

		}

		function isEdgeDegenerate( e ) {

			return Math.abs( e.end - e.start ) < eps;

		}

	}

	const DIST_EPSILON = 1e-5;
	const ANGLE_EPSILON = 1e-4;

	class RaySet {

		constructor() {

			this._rays = [];

		}

		addRay( ray ) {

			this._rays.push( ray );

		}

		findClosestRay( ray ) {

			const rays = this._rays;
			const inv = ray.clone();
			inv.direction.multiplyScalar( - 1 );

			let bestScore = Infinity;
			let bestRay = null;
			for ( let i = 0, l = rays.length; i < l; i ++ ) {

				const r = rays[ i ];
				if ( skipRay( r, ray ) && skipRay( r, inv ) ) {

					continue;

				}

				const rayScore = scoreRays( r, ray );
				const invScore = scoreRays( r, inv );
				const score = Math.min( rayScore, invScore );
				if ( score < bestScore ) {

					bestScore = score;
					bestRay = r;

				}

			}

			return bestRay;

			function skipRay( r0, r1 ) {

				const distOutOfThreshold = r0.origin.distanceTo( r1.origin ) > DIST_EPSILON;
				const angleOutOfThreshold = r0.direction.angleTo( r1.direction ) > ANGLE_EPSILON;
				return angleOutOfThreshold || distOutOfThreshold;

			}

			function scoreRays( r0, r1 ) {

				const originDistance = r0.origin.distanceTo( r1.origin );
				const angleDistance = r0.direction.angleTo( r1.direction );
				return originDistance / DIST_EPSILON + angleDistance / ANGLE_EPSILON;

			}

		}

	}

	const _v0 = new three.Vector3();
	const _v1 = new three.Vector3();
	const _ray$2 = new three.Ray();

	function computeDisjointEdges(
		geometry,
		unmatchedSet,
		eps,
	) {

		const attributes = geometry.attributes;
		const indexAttr = geometry.index;
		const posAttr = attributes.position;

		const disjointConnectivityMap = new Map();
		const fragmentMap = new Map();
		const edges = Array.from( unmatchedSet );
		const rays = new RaySet();

		for ( let i = 0, l = edges.length; i < l; i ++ ) {

			// get the triangle edge
			const index = edges[ i ];
			const triIndex = toTriIndex( index );
			const edgeIndex = toEdgeIndex( index );

			let i0 = 3 * triIndex + edgeIndex;
			let i1 = 3 * triIndex + ( edgeIndex + 1 ) % 3;
			if ( indexAttr ) {

				i0 = indexAttr.getX( i0 );
				i1 = indexAttr.getX( i1 );

			}

			_v0.fromBufferAttribute( posAttr, i0 );
			_v1.fromBufferAttribute( posAttr, i1 );

			// get the ray corresponding to the edge
			toNormalizedRay( _v0, _v1, _ray$2 );

			// find the shared ray with other edges
			let info;
			let commonRay = rays.findClosestRay( _ray$2 );
			if ( commonRay === null ) {

				commonRay = _ray$2.clone();
				rays.addRay( commonRay );

			}

			if ( ! fragmentMap.has( commonRay ) ) {

				fragmentMap.set( commonRay, {

					forward: [],
					reverse: [],
					ray: commonRay,

				} );

			}

			info = fragmentMap.get( commonRay );

			// store the stride of edge endpoints along the ray
			let start = getProjectedDistance( commonRay, _v0 );
			let end = getProjectedDistance( commonRay, _v1 );
			if ( start > end ) {

				[ start, end ] = [ end, start ];

			}

			if ( _ray$2.direction.dot( commonRay.direction ) < 0 ) {

				info.reverse.push( { start, end, index } );

			} else {

				info.forward.push( { start, end, index } );

			}

		}

		// match the found sibling edges
		fragmentMap.forEach( ( { forward, reverse }, ray ) => {

			matchEdges( forward, reverse, disjointConnectivityMap, eps );

			if ( forward.length === 0 && reverse.length === 0 ) {

				fragmentMap.delete( ray );

			}

		} );

		return {
			disjointConnectivityMap,
			fragmentMap,
		};

	}

	const _vec2$1 = new three.Vector2();
	const _vec3$1 = new three.Vector3();
	const _vec4 = new three.Vector4();
	const _hashes = [ '', '', '' ];

	class HalfEdgeMap {

		constructor( geometry = null ) {

			// result data
			this.data = null;
			this.disjointConnections = null;
			this.unmatchedDisjointEdges = null;
			this.unmatchedEdges = - 1;
			this.matchedEdges = - 1;

			// options
			this.useDrawRange = true;
			this.useAllAttributes = false;
			this.matchDisjointEdges = false;
			this.degenerateEpsilon = 1e-8;

			if ( geometry ) {

				this.updateFrom( geometry );

			}

		}

		getSiblingTriangleIndex( triIndex, edgeIndex ) {

			const otherIndex = this.data[ triIndex * 3 + edgeIndex ];
			return otherIndex === - 1 ? - 1 : ~ ~ ( otherIndex / 3 );

		}

		getSiblingEdgeIndex( triIndex, edgeIndex ) {

			const otherIndex = this.data[ triIndex * 3 + edgeIndex ];
			return otherIndex === - 1 ? - 1 : ( otherIndex % 3 );

		}

		getDisjointSiblingTriangleIndices( triIndex, edgeIndex ) {

			const index = triIndex * 3 + edgeIndex;
			const arr = this.disjointConnections.get( index );
			return arr ? arr.map( i => ~ ~ ( i / 3 ) ) : [];

		}

		getDisjointSiblingEdgeIndices( triIndex, edgeIndex ) {

			const index = triIndex * 3 + edgeIndex;
			const arr = this.disjointConnections.get( index );
			return arr ? arr.map( i => i % 3 ) : [];

		}

		isFullyConnected() {

			return this.unmatchedEdges === 0;

		}

		updateFrom( geometry ) {

			const { useAllAttributes, useDrawRange, matchDisjointEdges, degenerateEpsilon } = this;
			const hashFunction = useAllAttributes ? hashAllAttributes : hashPositionAttribute;

			// runs on the assumption that there is a 1 : 1 match of edges
			const map = new Map();

			// attributes
			const { attributes } = geometry;
			const attrKeys = useAllAttributes ? Object.keys( attributes ) : null;
			const indexAttr = geometry.index;
			const posAttr = attributes.position;

			// get the potential number of triangles
			let triCount = getTriCount( geometry );
			const maxTriCount = triCount;

			// get the real number of triangles from the based on the draw range
			let offset = 0;
			if ( useDrawRange ) {

				offset = geometry.drawRange.start;
				if ( geometry.drawRange.count !== Infinity ) {

					triCount = ~ ~ ( geometry.drawRange.count / 3 );

				}

			}

			// initialize the connectivity buffer - 1 means no connectivity
			let data = this.data;
			if ( ! data || data.length < 3 * maxTriCount ) {

				data = new Int32Array( 3 * maxTriCount );

			}

			data.fill( - 1 );

			// iterate over all triangles
			let matchedEdges = 0;
			let unmatchedSet = new Set();
			for ( let i = offset, l = triCount * 3 + offset; i < l; i += 3 ) {

				const i3 = i;
				for ( let e = 0; e < 3; e ++ ) {

					let i0 = i3 + e;
					if ( indexAttr ) {

						i0 = indexAttr.getX( i0 );

					}

					_hashes[ e ] = hashFunction( i0 );

				}

				for ( let e = 0; e < 3; e ++ ) {

					const nextE = ( e + 1 ) % 3;
					const vh0 = _hashes[ e ];
					const vh1 = _hashes[ nextE ];

					const reverseHash = `${ vh1 }_${ vh0 }`;
					if ( map.has( reverseHash ) ) {

						// create a reference between the two triangles and clear the hash
						const index = i3 + e;
						const otherIndex = map.get( reverseHash );
						data[ index ] = otherIndex;
						data[ otherIndex ] = index;
						map.delete( reverseHash );
						matchedEdges += 2;
						unmatchedSet.delete( otherIndex );

					} else {

						// save the triangle and triangle edge index captured in one value
						// triIndex = ~ ~ ( i0 / 3 );
						// edgeIndex = i0 % 3;
						const hash = `${ vh0 }_${ vh1 }`;
						const index = i3 + e;
						map.set( hash, index );
						unmatchedSet.add( index );

					}

				}

			}

			if ( matchDisjointEdges ) {

				const {
					fragmentMap,
					disjointConnectivityMap,
				} = computeDisjointEdges( geometry, unmatchedSet, degenerateEpsilon );

				unmatchedSet.clear();
				fragmentMap.forEach( ( { forward, reverse } ) => {

					forward.forEach( ( { index } ) => unmatchedSet.add( index ) );
					reverse.forEach( ( { index } ) => unmatchedSet.add( index ) );

				} );

				this.unmatchedDisjointEdges = fragmentMap;
				this.disjointConnections = disjointConnectivityMap;
				matchedEdges = triCount * 3 - unmatchedSet.size;

			}

			this.matchedEdges = matchedEdges;
			this.unmatchedEdges = unmatchedSet.size;
			this.data = data;

			function hashPositionAttribute( i ) {

				_vec3$1.fromBufferAttribute( posAttr, i );
				return hashVertex3( _vec3$1 );

			}

			function hashAllAttributes( i ) {

				let result = '';
				for ( let k = 0, l = attrKeys.length; k < l; k ++ ) {

					const attr = attributes[ attrKeys[ k ] ];
					let str;
					switch ( attr.itemSize ) {

						case 1:
							str = hashNumber( attr.getX( i ) );
							break;
						case 2:
							str = hashVertex2( _vec2$1.fromBufferAttribute( attr, i ) );
							break;
						case 3:
							str = hashVertex3( _vec3$1.fromBufferAttribute( attr, i ) );
							break;
						case 4:
							str = hashVertex4( _vec4.fromBufferAttribute( attr, i ) );
							break;

					}

					if ( result !== '' ) {

						result += '|';

					}

					result += str;

				}

				return result;

			}

		}

	}

	class Brush extends three.Mesh {

		constructor( ...args ) {

			super( ...args );

			this.isBrush = true;
			this._previousMatrix = new three.Matrix4();
			this._previousMatrix.elements.fill( 0 );

		}

		markUpdated() {

			this._previousMatrix.copy( this.matrix );

		}

		isDirty() {

			const { matrix, _previousMatrix } = this;
			const el1 = matrix.elements;
			const el2 = _previousMatrix.elements;
			for ( let i = 0; i < 16; i ++ ) {

				if ( el1[ i ] !== el2[ i ] ) {

					return true;

				}

			}

			return false;

		}

		prepareGeometry() {

			// generate shared array buffers
			const geometry = this.geometry;
			const attributes = geometry.attributes;
			const useSharedArrayBuffer = areSharedArrayBuffersSupported();
			if ( useSharedArrayBuffer ) {

				for ( const key in attributes ) {

					const attribute = attributes[ key ];
					if ( attribute.isInterleavedBufferAttribute ) {

						throw new Error( 'Brush: InterleavedBufferAttributes are not supported.' );

					}

					attribute.array = convertToSharedArrayBuffer( attribute.array );

				}

			}

			// generate bounds tree
			if ( ! geometry.boundsTree ) {

				ensureIndex( geometry, { useSharedArrayBuffer } );
				geometry.boundsTree = new threeMeshBvh.MeshBVH( geometry, { maxLeafTris: 3, indirect: true, useSharedArrayBuffer } );

			}

			// generate half edges
			if ( ! geometry.halfEdges ) {

				geometry.halfEdges = new HalfEdgeMap( geometry );

			}

			// save group indices for materials
			if ( ! geometry.groupIndices ) {

				const triCount = getTriCount( geometry );
				const array = new Uint16Array( triCount );
				const groups = geometry.groups;
				for ( let i = 0, l = groups.length; i < l; i ++ ) {

					const { start, count } = groups[ i ];
					for ( let g = start / 3, lg = ( start + count ) / 3; g < lg; g ++ ) {

						array[ g ] = i;

					}

				}

				geometry.groupIndices = array;

			}

		}

		disposeCacheData() {

			const { geometry } = this;
			geometry.halfEdges = null;
			geometry.boundsTree = null;
			geometry.groupIndices = null;

		}

	}

	const EPSILON$1 = 1e-14;
	const _AB = new three.Vector3();
	const _AC = new three.Vector3();
	const _CB = new three.Vector3();

	function isTriDegenerate( tri, eps = EPSILON$1 ) {

		// compute angles to determine whether they're degenerate
		_AB.subVectors( tri.b, tri.a );
		_AC.subVectors( tri.c, tri.a );
		_CB.subVectors( tri.b, tri.c );

		const angle1 = _AB.angleTo( _AC );				// AB v AC
		const angle2 = _AB.angleTo( _CB );				// AB v BC
		const angle3 = Math.PI - angle1 - angle2;		// 180deg - angle1 - angle2

		return Math.abs( angle1 ) < eps ||
			Math.abs( angle2 ) < eps ||
			Math.abs( angle3 ) < eps ||
			tri.a.distanceToSquared( tri.b ) < eps ||
			tri.a.distanceToSquared( tri.c ) < eps ||
			tri.b.distanceToSquared( tri.c ) < eps;

	}

	// NOTE: these epsilons likely should all be the same since they're used to measure the
	// distance from a point to a plane which needs to be done consistently
	const EPSILON = 1e-10;
	const COPLANAR_EPSILON = 1e-10;
	const PARALLEL_EPSILON = 1e-10;
	const _edge$2 = new three.Line3();
	const _foundEdge = new three.Line3();
	const _vec$1 = new three.Vector3();
	const _triangleNormal = new three.Vector3();
	const _planeNormal = new three.Vector3();
	const _plane$1 = new three.Plane();
	// MODIFICATION START
	// Use a defensive approach to get ExtendedTriangle, directly referencing global MeshBVHLib
	// Added debugger to inspect global objects
	debugger; // Added debugger
	const _ExtendedTriangle = (typeof MeshBVHLib !== 'undefined' && MeshBVHLib.ExtendedTriangle) ? MeshBVHLib.ExtendedTriangle : (typeof THREE !== 'undefined' && THREE.ExtendedTriangle ? THREE.ExtendedTriangle : null);
	if (!_ExtendedTriangle) {
	    throw new Error("three-bvh-csg: ExtendedTriangle class not found. Ensure three-mesh-bvh.umd.js is loaded correctly and exposes ExtendedTriangle.");
	}
	const _splittingTriangle = new _ExtendedTriangle();
	// MODIFICATION END

	// A pool of triangles to avoid unnecessary triangle creation
	class TrianglePool {

		constructor() {

			this._pool = [];
			this._index = 0;

		}

		getTriangle() {

			if ( this._index >= this._pool.length ) {

				this._pool.push( new three.Triangle() );

			}

			return this._pool[ this._index ++ ];

		}

		clear() {

			this._index = 0;

		}

		reset() {

			this._pool.length = 0;
			this._index = 0;

		}

	}

	// Utility class for splitting triangles
	class TriangleSplitter {

		constructor() {

			this.trianglePool = new TrianglePool();
			this.triangles = [];
			this.normal = new three.Vector3();
			this.coplanarTriangleUsed = false;

		}

		// initialize the class with a triangle
		initialize( tri ) {

			this.reset();

			const { triangles, trianglePool, normal } = this;
			if ( Array.isArray( tri ) ) {

				for ( let i = 0, l = tri.length; i < l; i ++ ) {

					const t = tri[ i ];
					if ( i === 0 ) {

						t.getNormal( normal );

					} else if ( Math.abs( 1.0 - t.getNormal( _vec$1 ).dot( normal ) ) > EPSILON ) {

						throw new Error( 'Triangle Splitter: Cannot initialize with triangles that have different normals.' );

					}

					const poolTri = trianglePool.getTriangle();
					poolTri.copy( t );
					triangles.push( poolTri );

				}

			} else {

				tri.getNormal( normal );

				const poolTri = trianglePool.getTriangle();
				poolTri.copy( tri );
				triangles.push( poolTri );

			}

		}

		// Split the current set of triangles by passing a single triangle in. If the triangle is
		// coplanar it will attempt to split by the triangle edge planes
		splitByTriangle( triangle ) {

			const { normal, triangles } = this;
			triangle.getNormal( _triangleNormal ).normalize();

			if ( Math.abs( 1.0 - Math.abs( _triangleNormal.dot( normal ) ) ) < PARALLEL_EPSILON ) {

				this.coplanarTriangleUsed = true;

				for ( let i = 0, l = triangles.length; i < l; i ++ ) {

					const t = triangles[ i ];
					t.coplanarCount = 0;

				}

				// if the triangle is coplanar then split by the edge planes
				const arr = [ triangle.a, triangle.b, triangle.c ];
				for ( let i = 0; i < 3; i ++ ) {

					const nexti = ( i + 1 ) % 3;

					const v0 = arr[ i ];
					const v1 = arr[ nexti ];

					// plane positive direction is toward triangle center
					_vec$1.subVectors( v1, v0 ).normalize();
					_planeNormal.crossVectors( _triangleNormal, _vec$1 );
					_plane$1.setFromNormalAndCoplanarPoint( _planeNormal, v0 );

					this.splitByPlane( _plane$1, triangle );

				}

			} else {

				// otherwise split by the triangle plane
				triangle.getPlane( _plane$1 );
				this.splitByPlane( _plane$1, triangle );

			}

		}

		// Split the triangles by the given plan. If a triangle is provided then we ensure we
		// intersect the triangle before splitting the plane
		splitByPlane( plane, clippingTriangle ) {

			const { triangles, trianglePool } = this;

			// init our triangle to check for intersection
			_splittingTriangle.copy( clippingTriangle );
			_splittingTriangle.needsUpdate = true;

			// try to split every triangle in the class
			for ( let i = 0, l = triangles.length; i < l; i ++ ) {

				const tri = triangles[ i ];

				// skip the triangle if we don't intersect with it
				if ( ! _splittingTriangle.intersectsTriangle( tri, _edge$2, true ) ) {

					continue;

				}

				const { a, b, c } = tri;
				let intersects = 0;
				let vertexSplitEnd = - 1;
				let coplanarEdge = false;
				let posSideVerts = [];
				let negSideVerts = [];
				const arr = [ a, b, c ];
				for ( let t = 0; t < 3; t ++ ) {

					// get the triangle edge
					const tNext = ( t + 1 ) % 3;
					_edge$2.start.copy( arr[ t ] );
					_edge$2.end.copy( arr[ tNext ] );

					// track if the start point sits on the plane or if it's on the positive side of it
					// so we can use that information to determine whether to split later.
					const startDist = plane.distanceToPoint( _edge$2.start );
					const endDist = plane.distanceToPoint( _edge$2.end );
					if ( Math.abs( startDist ) < COPLANAR_EPSILON && Math.abs( endDist ) < COPLANAR_EPSILON ) {

						coplanarEdge = true;
						break;

					}

					if ( startDist > 0 ) {

						posSideVerts.push( t );

					} else {

						negSideVerts.push( t );

					}

					// we only don't consider this an intersection if the start points hits the plane
					if ( Math.abs( startDist ) < COPLANAR_EPSILON ) {

						continue;

					}

					// double check the end point since the "intersectLine" function sometimes does not
					// return it as an intersection (see issue #28)
					// Because we ignore the start point intersection above we have to make sure we check the end
					// point intersection here.
					let didIntersect = ! ! plane.intersectLine( _edge$2, _vec$1 );
					if ( ! didIntersect && Math.abs( endDist ) < COPLANAR_EPSILON ) {

						_vec$1.copy( _edge$2.end );
						didIntersect = true;

					}

					// check if we intersect the plane (ignoring the start point so we don't double count)
					if ( didIntersect && ! ( _vec$1.distanceTo( _edge$2.start ) < EPSILON ) ) {

						// if we intersect at the end point then we track that point as one that we
						// have to split down the middle
						if ( _vec$1.distanceTo( _edge$2.end ) < EPSILON ) {

							vertexSplitEnd = t;

						}

						// track the split edge
						if ( intersects === 0 ) {

							_foundEdge.start.copy( _vec$1 );

						} else {

							_foundEdge.end.copy( _vec$1 );

						}

						intersects ++;

					}

				}

				// skip splitting if:
				// - we have two points on the plane then the plane intersects the triangle exactly on an edge
				// - the plane does not intersect on 2 points
				// - the intersection edge is too small
				// - we're not along a coplanar edge
				if ( ! coplanarEdge && intersects === 2 && _foundEdge.distance() > COPLANAR_EPSILON ) {

					if ( vertexSplitEnd !== - 1 ) {

						vertexSplitEnd = ( vertexSplitEnd + 1 ) % 3;

						// we're splitting along a vertex
						let otherVert1 = 0;
						if ( otherVert1 === vertexSplitEnd ) {

							otherVert1 = ( otherVert1 + 1 ) % 3;

						}

						let otherVert2 = otherVert1 + 1;
						if ( otherVert2 === vertexSplitEnd ) {

							otherVert2 = ( otherVert2 + 1 ) % 3;

						}

						const nextTri = trianglePool.getTriangle();
						nextTri.a.copy( arr[ otherVert2 ] );
						nextTri.b.copy( _foundEdge.end );
						nextTri.c.copy( _foundEdge.start );

						if ( ! isTriDegenerate( nextTri ) ) {

							triangles.push( nextTri );

						}

						tri.a.copy( arr[ otherVert1 ] );
						tri.b.copy( _foundEdge.start );
						tri.c.copy( _foundEdge.end );

						// finish off the adjusted triangle
						if ( isTriDegenerate( tri ) ) {

							triangles.splice( i, 1 );
							i --;
							l --;

						}

					} else {

						// we're splitting with a quad and a triangle
						// TODO: what happens when we find that about the pos and negative
						// sides have only a single vertex?
						const singleVert =
							posSideVerts.length >= 2 ?
								negSideVerts[ 0 ] :
								posSideVerts[ 0 ];

						// swap the direction of the intersection edge depending on which
						// side of the plane the single vertex is on to align with the
						// correct winding order.
						if ( singleVert === 0 ) {

							let tmp = _foundEdge.start;
							_foundEdge.start = _foundEdge.end;
							_foundEdge.end = tmp;

						}

						const nextVert1 = ( singleVert + 1 ) % 3;
						const nextVert2 = ( singleVert + 2 ) % 3;

						const nextTri1 = trianglePool.getTriangle();
						const nextTri2 = trianglePool.getTriangle();

						// choose the triangle that has the larger areas (shortest split distance)
						if ( arr[ nextVert1 ].distanceToSquared( _foundEdge.start ) < arr[ nextVert2 ].distanceToSquared( _foundEdge.end ) ) {

							nextTri1.a.copy( arr[ nextVert1 ] );
							nextTri1.b.copy( _foundEdge.start );
							nextTri1.c.copy( _foundEdge.end );

							nextTri2.a.copy( arr[ nextVert1 ] );
							nextTri2.b.copy( arr[ nextVert2 ] );
							nextTri2.c.copy( _foundEdge.start );

						} else {

							nextTri1.a.copy( arr[ nextVert2 ] );
							nextTri1.b.copy( _foundEdge.start );
							nextTri1.c.copy( _foundEdge.end );

							nextTri2.a.copy( arr[ nextVert1 ] );
							nextTri2.b.copy( arr[ nextVert2 ] );
							nextTri2.c.copy( _foundEdge.end );

						}

						tri.a.copy( arr[ singleVert ] );
						tri.b.copy( _foundEdge.end );
						tri.c.copy( _foundEdge.start );

						// don't add degenerate triangles to the list
						if ( ! isTriDegenerate( nextTri1 ) ) {

							triangles.push( nextTri1 );

						}

						if ( ! isTriDegenerate( nextTri2 ) ) {

							triangles.push( nextTri2 );

						}

						// finish off the adjusted triangle
						if ( isTriDegenerate( tri ) ) {

							triangles.splice( i, 1 );
							i --;
							l --;

						}

					}

				} else if ( intersects === 3 ) {

					console.warn( 'TriangleClipper: Coplanar clip not handled' );

				}

			}

		}

		reset() {

			this.triangles.length = 0;
			this.trianglePool.clear();
			this.coplanarTriangleUsed = false;

		}

	}

	function ceilToFourByteStride( byteLength ) {

		byteLength = ~ ~ byteLength;
		return byteLength + 4 - byteLength % 4;

	}

	// Make a new array wrapper class that more easily affords expansion when reaching it's max capacity
	class TypeBackedArray {

		constructor( type, initialSize = 500 ) {


			this.expansionFactor = 1.5;
			this.type = type;
			this.length = 0;
			this.array = null;

			this.setSize( initialSize );

		}

		setType( type ) {

			if ( this.length !== 0 ) {

				throw new Error( 'TypeBackedArray: Cannot change the type while there is used data in the buffer.' );

			}

			const buffer = this.array.buffer;
			this.array = new type( buffer );
			this.type = type;

		}

		setSize( size ) {

			if ( this.array && size === this.array.length ) {

				return;

			}

			// ceil to the nearest 4 bytes so we can replace the array with any type using the same buffer
			const type = this.type;
			const bufferType = areSharedArrayBuffersSupported() ? SharedArrayBuffer : ArrayBuffer;
			const newArray = new type( new bufferType( ceilToFourByteStride( size * type.BYTES_PER_ELEMENT ) ) );
			if ( this.array ) {

				newArray.set( this.array, 0 );

			}

			this.array = newArray;

		}

		expand() {

			const { array, expansionFactor } = this;
			this.setSize( array.length * expansionFactor );

		}

		push( ...args ) {

			let { array, length } = this;
			if ( length + args.length > array.length ) {

				this.expand();
				array = this.array;

			}

			for ( let i = 0, l = args.length; i < l; i ++ ) {

				array[ length + i ] = args[ i ];

			}

			this.length += args.length;

		}

		clear() {

			this.length = 0;

		}

	}

	// Utility class for for tracking attribute data in type-backed arrays for a set
	// of groups. The set of attributes is kept for each group and are expected to be the
	// same buffer type.
	class TypedAttributeData {

		constructor() {

			this.groupAttributes = [ {} ];
			this.groupCount = 0;

		}

		// returns the buffer type for the given attribute
		getType( name ) {

			return this.groupAttributes[ 0 ][ name ].type;

		}

		getItemSize( name ) {

			return this.groupAttributes[ 0 ][ name ].itemSize;

		}

		getNormalized( name ) {

			return this.groupAttributes[ 0 ][ name ].normalized;

		}

		getCount( index ) {

			if ( this.groupCount <= index ) {

				return 0;

			}

			const pos = this.getGroupAttrArray( 'position', index );
			return pos.length / pos.itemSize;

		}

		// returns the total length required for all groups for the given attribute
		getTotalLength( name ) {

			const { groupCount, groupAttributes } = this;

			let length = 0;
			for ( let i = 0; i < groupCount; i ++ ) {

				const attrSet = groupAttributes[ i ];
				length += attrSet[ name ].length;

			}

			return length;

		}

		getGroupAttrSet( index = 0 ) {

			// TODO: can this be abstracted?
			// Return the exiting group set if necessary
			const { groupAttributes } = this;
			if ( groupAttributes[ index ] ) {

				this.groupCount = Math.max( this.groupCount, index + 1 );
				return groupAttributes[ index ];

			}

			// add any new group sets required
			const refAttrSet = groupAttributes[ 0 ];
			this.groupCount = Math.max( this.groupCount, index + 1 );
			while ( index >= groupAttributes.length ) {

				const newAttrSet = {};
				groupAttributes.push( newAttrSet );
				for ( const key in refAttrSet ) {

					const refAttr = refAttrSet[ key ];
					const newAttr = new TypeBackedArray( refAttr.type );
					newAttr.itemSize = refAttr.itemSize;
					newAttr.normalized = refAttr.normalized;
					newAttrSet[ key ] = newAttr;

				}

			}

			return groupAttributes[ index ];

		}

		// Get the raw array for the group set of data
		getGroupAttrArray( name, index = 0 ) {

			// throw an error if we've never
			const { groupAttributes } = this;
			const referenceAttrSet = groupAttributes[ 0 ];
			const referenceAttr = referenceAttrSet[ name ];
			if ( ! referenceAttr ) {

				throw new Error( `TypedAttributeData: Attribute "${ name }" does not exist.` );

			}

			const groupAttrSet = this.getGroupAttrSet( index );
			return groupAttrSet[ name ];

		}

		// Add a new attribute array for the given group index
		set  ( name, array, itemSize, normalized, index = 0 ) {

			const groupAttrSet = this.getGroupAttrSet( index );
			const newAttr = new TypeBackedArray( array.constructor, array.length );
			newAttr.push( ...array );
			newAttr.itemSize = itemSize;
			newAttr.normalized = normalized;
			groupAttrSet[ name ] = newAttr;

		}

		// Push a new value to the given attribute array for the given group index
		push( name, index = 0, ...args ) {

			const groupAttr = this.getGroupAttrArray( name, index );
			groupAttr.push( ...args );

		}

		// Clear the data for the given group index
		clear( index = 0 ) {

			const groupAttrSet = this.groupAttributes[ index ];
			for ( const key in groupAttrSet ) {

				groupAttrSet[ key ].clear();

			}

		}

		// Copy the data from the given attribute array to the given group index
		copy( name, sourceArray, index = 0 ) {

			const groupAttr = this.getGroupAttrArray( name, index );
			groupAttr.clear();
			groupAttr.push( ...sourceArray );

		}

		// Resize the internal array buffer for the given attribute name across all groups
		resize( name, size ) {

			const { groupAttributes, groupCount } = this;
			for ( let i = 0; i < groupCount; i ++ ) {

				const attr = groupAttributes[ i ][ name ];
				attr.setSize( size );

			}

		}

		// Resize the internal array buffer for all attributes across all groups
		resizeAll( size ) {

			const { groupAttributes, groupCount } = this;
			for ( let i = 0; i < groupCount; i ++ ) {

				const attrSet = groupAttributes[ i ];
				for ( const key in attrSet ) {

					attrSet[ key ].setSize( size );

				}

			}

		}

		// Convert all internal arrays to SharedArrayBuffer
		enableSharedArrayBuffers() {

			const { groupAttributes, groupCount } = this;
			for ( let i = 0; i < groupCount; i ++ ) {

				const attrSet = groupAttributes[ i ];
				for ( const key in attrSet ) {

					const attr = attrSet[ key ];
					attr.array = convertToSharedArrayBuffer( attr.array );

				}

			}

		}

	}

	const _vec0 = new three.Vector3();
	const _vec1 = new three.Vector3();
	const _vec2 = new three.Vector3();
	const _tri = new three.Triangle();
	const _tri2 = new three.Triangle();
	const _matrix = new three.Matrix4();
	const _inverseMatrix = new three.Matrix4();
	const _normal = new three.Vector3();
	const _center = new three.Vector3();
	const _to  = new three.Vector3();
	const _from = new three.Vector3();
	const _up = new three.Vector3();
	const _forward = new three.Vector3();
	const _right = new three.Vector3();

	const _tempArray = [];
	const _tempArray2 = [];

	// Declare these variables at the module scope to avoid redeclaration issues
	let _posAttr;
	let _normalAttr;
	let _uvAttr;

	class CSG {

		constructor() {

			this.useWindingOrder = false;
			this.use  = false;
			this.useGroups = true;
			this.keepIntersections = false;

			this.triangleSplitter = new TriangleSplitter();
			this.attributeData = new TypedAttributeData();

			this.operation = 0;

		}

		// initialize the csg with a brush. This function will clone the brush so it can be
		// modified without affecting the original.
		initialize( brush ) {

			const { geometry, matrixWorld } = brush;
			const { attributeData, triangleSplitter } = this;

			// ensure the geometry has the necessary data
			brush.prepareGeometry();

			// get the world matrix for the brush
			_matrix.copy( matrixWorld );
			_inverseMatrix.copy( _matrix ).invert();

			// get the attributes
			const attributes = geometry.attributes;
			for ( const key in attributes ) {

				const attribute = attributes[ key ];
				attributeData.set( key, attribute.array, attribute.itemSize, attribute.normalized );

			}

			// get the groups
			const groups = geometry.groups;
			attributeData.groupCount = groups.length;
			for ( let i = 0, l = groups.length; i < l; i ++ ) {

				const group = groups[ i ];
				attributeData.getGroupAttrSet( i ).start = group.start;
				attributeData.getGroupAttrSet( i ).count = group.count;

			}

			// get the triangles
			const triCount = getTriCount( geometry );
			const indexAttr = geometry.index;
			const posAttr = geometry.attributes.position; // This declaration is fine as it's local to this method
			triangleSplitter.reset();
			for ( let i = 0; i < triCount; i ++ ) {

				const i3 = i * 3;
				let i0 = i3 + 0;
				let i1 = i3 + 1;
				let i2 = i3 + 2;

				if ( indexAttr ) {

					i0 = indexAttr.getX( i0 );
					i1 = indexAttr.getX( i1 );
					i2 = indexAttr.getX( i2 );

				}

				_vec0.fromBufferAttribute( posAttr, i0 ).applyMatrix4( _matrix );
				_vec1.fromBufferAttribute( posAttr, i1 ).applyMatrix4( _matrix );
				_vec2.fromBufferAttribute( posAttr, i2 ).applyMatrix4( _matrix );

				const tri = triangleSplitter.trianglePool.getTriangle();
				tri.a.copy( _vec0 );
				tri.b.copy( _vec1 );
				tri.c.copy( _vec2 );

				// store the attribute indices
				tri.a._index = i0;
				tri.b._index = i1;
				tri.c._index = i2;

				// store the group index
				tri.groupIndex = geometry.groupIndices[ i ];

				triangleSplitter.triangles.push( tri );

			}

		}

		// Performs a CSG operation against a brush
		performOperation( brush ) {

			if ( brush.isDirty() ) {

				brush.prepareGeometry();

			}

			const { geometry, matrixWorld } = brush;
			const { triangleSplitter, useWindingOrder, useGroups, keepIntersections } = this;
			const attributeData = this.attributeData; // Keep this local to the method

			// get the world matrix for the brush
			_matrix.copy( matrixWorld );
			_inverseMatrix.copy( _matrix ).invert();

			// get the triangles
			const triCount = getTriCount( geometry );
			const indexAttr = geometry.index;
			const posAttr = geometry.attributes.position; // This declaration is fine as it's local to this method

			// Assign to module-scoped variables
			_posAttr = attributeData.getGroupAttrArray( 'position', 0 );
			_normalAttr = attributeData.getGroupAttrArray( 'normal', 0 );
			_uvAttr = attributeData.getGroupAttrArray( 'uv', 0 );


			// iterate over all triangles
			for ( let i = 0; i < triCount; i ++ ) {

				const i3 = i * 3;
				let i0 = i3 + 0;
				let i1 = i3 + 1;
				let i2 = i3 + 2;

				if ( indexAttr ) {

					i0 = indexAttr.getX( i0 );
					i1 = indexAttr.getX( i1 );
					i2 = indexAttr.getX( i2 );

				}

				_vec0.fromBufferAttribute( posAttr, i0 ).applyMatrix4( _matrix );
				_vec1.fromBufferAttribute( posAttr, i1 ).applyMatrix4( _matrix );
				_vec2.fromBufferAttribute( posAttr, i2 ).applyMatrix4( _matrix );

				_tri.a.copy( _vec0 );
				_tri.b.copy( _vec1 );
				_tri.c.copy( _vec2 );

				// store the group index
				_tri.groupIndex = geometry.groupIndices[ i ];

				triangleSplitter.splitByTriangle( _tri );

			}

			// filter the remaining triangles
			const result = [];
			const triArray = triangleSplitter.triangles;
			for ( let i = 0, l = triArray.length; i < l; i ++ ) {

				const tri = triArray[ i ];
				tri.getNormal( _normal );
				_center.copy( tri.a ).add( tri.b ).add( tri.c ).multiplyScalar( 1 / 3 );

				const isInverted = _normal.dot( _center.clone().applyMatrix4( _inverseMatrix ) ) < 0;
				const isInside = brush.geometry.boundsTree.containsPoint( _center, _inverseMatrix );

				let shouldAdd = false;
				if ( this.operation === 0 ) { // UNION

					shouldAdd = ! isInside;

				} else if ( this.operation === 1 ) { // SUBTRACTION

					shouldAdd = ! isInside || isInverted;

				} else if ( this.operation === 2 ) { // INTERSECTION

					shouldAdd = isInside;

				}

				if ( shouldAdd ) {

					result.push( tri );

				}

			}

			// filter out the triangles that are on the split plane
			if ( triangleSplitter.coplanarTriangleUsed ) {

				// if the split triangle was coplanar then we have to perform some more
				// checks to ensure we're removing the right pieces
				const coplanar = [];
				const nonCoplanar = [];
				for ( let i = 0, l = result.length; i < l; i ++ ) {

					const tri = result[ i ];
					tri.getNormal( _normal );
					if ( Math.abs( _normal.dot( _triangleNormal ) ) > PARALLEL_EPSILON ) {

						coplanar.push( tri );

					} else {

						nonCoplanar.push( tri );

					}

				}

				for ( let i = 0, l = coplanar.length; i < l; i ++ ) {

					const tri = coplanar[ i ];
					tri.getNormal( _normal );
					_center.copy( tri.a ).add( tri.b ).add( tri.c ).multiplyScalar( 1 / 3 );

					const isInside = _tri.containsPoint( _center );
					const isCoplanarFront = _normal.dot( _triangleNormal ) > 0;

					let shouldAdd = false;
					if ( this.operation === 0 ) { // UNION

						shouldAdd = ! isInside || ! isCoplanarFront;

					} else if ( this.operation === 1 ) { // SUBTRACTION

						shouldAdd = ! isInside || isCoplanarFront;

					} else if ( this.operation === 2 ) { // INTERSECTION

						shouldAdd = isInside && isCoplanarFront;

					}

					if ( shouldAdd ) {

						nonCoplanar.push( tri );

					}

				}

				result.length = 0;
				result.push( ...nonCoplanar );

			}

			// remap the indices to the original attributes
			const finalTriangles = [];
			// const attributeData = this.attributeData; // Already declared above or passed as argument

			const newGroups = [];
			const groupMap = new Map();

			for ( let i = 0, l = result.length; i < l; i ++ ) {

				const tri = result[ i ];
				const { a, b, c } = tri;

				// get the original indices
				const i0 = a._index;
				const i1 = b._index;
				const i2 = c._index;

				// get the original attributes
				_vec0.fromArray( _posAttr.array, i0 * 3 ); // Use module-scoped _posAttr
				_vec1.fromArray( _posAttr.array, i1 * 3 ); // Use module-scoped _posAttr
				_vec2.fromArray( _posAttr.array, i2 * 3 ); // Use module-scoped _posAttr

				_tri2.a.copy( _vec0 );
				_tri2.b.copy( _vec1 );
				_tri2.c.copy( _vec2 );

				// check if the winding order is inverted
				_tri.getNormal( _normal );
				_tri2.getNormal( _vec$1 );
				const isWindingOrderInverted = _normal.dot( _vec$1 ) < 0;

				// if the winding order is inverted then swap the indices
				if ( useWindingOrder && isWindingOrderInverted ) {

					finalTriangles.push( i0, i2, i1 );

				} else {

					finalTriangles.push( i0, i1, i2 );

				}

				// handle groups
				if ( useGroups ) {

					const groupIndex = tri.groupIndex;
					if ( ! groupMap.has( groupIndex ) ) {

						groupMap.set( groupIndex, {
							start: finalTriangles.length - 3,
							count: 3,
							materialIndex: groupIndex
						} );
						newGroups.push( groupMap.get( groupIndex ) );

					} else {

						groupMap.get( groupIndex ).count += 3;

					}

				}

			}

			// filter out unused attributes
			const finalAttributes = {};
			const finalAttributeArrays = {};
			// const finalAttributeData = this.attributeData; // Already declared above or passed as argument
			for ( const key in attributeData.groupAttributes[ 0 ] ) {

				const attr = attributeData.getGroupAttrArray( key, 0 );
				const newArray = new attr.type( attributeData.getTotalLength( key ) );
				finalAttributeArrays[ key ] = newArray;

			}

			// populate the final attribute arrays
			const finalIndexMap = new Map();
			let finalIndex = 0;
			for ( let i = 0, l = finalTriangles.length; i < l; i ++ ) {

				const originalIndex = finalTriangles[ i ];
				if ( ! finalIndexMap.has( originalIndex ) ) {

					finalIndexMap.set( originalIndex, finalIndex );

					for ( const key in attributeData.groupAttributes[ 0 ] ) {

						const attr = attributeData.getGroupAttrArray( key, 0 );
						const itemSize = attr.itemSize;
						const originalArray = attr.array;
						const newArray = finalAttributeArrays[ key ];

						for ( let t = 0; t < itemSize; t ++ ) {

							newArray[ finalIndex * itemSize + t ] = originalArray[ originalIndex * itemSize + t ];

						}

					}

					finalIndex ++;

				}

				finalTriangles[ i ] = finalIndexMap.get( originalIndex );

			}

			// create the final attributes
			for ( const key in attributeData.groupAttributes[ 0 ] ) {

				const attr = attributeData.getGroupAttrArray( key, 0 );
				finalAttributes[ key ] = new three.BufferAttribute(
					attr.array.subarray( 0, finalIndex * attr.itemSize ),
					attr.itemSize,
					attr.normalized,
				);

			}

			// create the final geometry
			const finalGeometry = new three.BufferGeometry();
			finalGeometry.setAttribute( 'position', finalAttributes.position );
			finalGeometry.setAttribute( 'normal', finalAttributes.normal );
			finalGeometry.setAttribute( 'uv', finalAttributes.uv );
			finalGeometry.setIndex( finalTriangles );
			finalGeometry.groups = newGroups;

			return finalGeometry;

		}

		// Performs a CSG union operation
		union( brush1, brush2 ) {

			this.operation = 0; // UNION

			this.initialize( brush1 );
			this.performOperation( brush2 );

			return this.toMesh();

		}

		// Performs a CSG subtraction operation
		subtract( brush1, brush2 ) {

			this.operation = 1; // SUBTRACTION

			this.initialize( brush1 );
			this.performOperation( brush2 );

			return this.toMesh();

		}

		// Performs a CSG intersection operation
		intersect( brush1, brush2 ) {

			this.operation = 2; // INTERSECTION

			this.initialize( brush1 );
			this.performOperation( brush2 );

			return this.toMesh();

		}

		// Converts the current state of the CSG to a mesh
		toMesh() {

			const { attributeData, triangleSplitter } = this;

			// create the final geometry
			const geometry = new three.BufferGeometry();

			// Assign to module-scoped variables
			_posAttr = attributeData.getGroupAttrArray( 'position', 0 );
			_normalAttr = attributeData.getGroupAttrArray( 'normal', 0 );
			_uvAttr = attributeData.getGroupAttrArray( 'uv', 0 );

			// create the attributes
			const attributes = {};
			for ( const key in attributeData.groupAttributes[ 0 ] ) {

				const attr = attributeData.getGroupAttrArray( key, 0 );
				attributes[ key ] = new three.BufferAttribute(
					attr.array.subarray( 0, attr.length ),
					attr.itemSize,
					attr.normalized,
				);

			}

			geometry.setAttribute( 'position', attributes.position );
			geometry.setAttribute( 'normal', attributes.normal );
			geometry.setAttribute( 'uv', attributes.uv );

			// create the index
			const index = new Uint32Array( triangleSplitter.triangles.length * 3 );
			for ( let i = 0, l = triangleSplitter.triangles.length; i < l; i ++ ) {

				const tri = triangleSplitter.triangles[ i ];
				const i3 = i * 3;
				index[ i3 + 0 ] = tri.a._index;
				index[ i3 + 1 ] = tri.b._index;
				index[ i3 + 2 ] = tri.c._index;

			}

			geometry.setIndex( new three.BufferAttribute( index, 1 ) );

			// create the groups
			const groups = [];
			const groupMap = new Map();
			for ( let i = 0, l = triangleSplitter.triangles.length; i < l; i ++ ) {

				const tri = triangleSplitter.triangles[ i ];
				const groupIndex = tri.groupIndex;
				if ( ! groupMap.has( groupIndex ) ) {

					groupMap.set( groupIndex, {
						start: i * 3,
						count: 3,
						materialIndex: groupIndex
					} );
					groups.push( groupMap.get( groupIndex ) );

				} else {

					groupMap.get( groupIndex ).count += 3;

				}

			}

			geometry.groups = groups;

			const mesh = new three.Mesh( geometry, new three.MeshStandardMaterial() );
			mesh.isCSG = true;

			return mesh;

		}

	}

	exports.Brush = Brush;
	exports.CSG = CSG;
	exports.HalfEdgeMap = HalfEdgeMap;
	exports.TypedAttributeData = TypedAttributeData;
	exports.TriangleSplitter = TriangleSplitter;
	exports.areSharedArrayBuffersSupported = areSharedArrayBuffersSupported;
	exports.ceilToFourByteStride = ceilToFourByteStride;
	exports.computeDisjointEdges = computeDisjointEdges;
	exports.convertToSharedArrayBuffer = convertToSharedArrayBuffer;
	exports.ensureIndex = ensureIndex;
	exports.getEdgeSetLength = getEdgeSetLength;
	exports.getIndexArray = getIndexArray;
	exports.getProjectedDistance = getProjectedDistance;
	exports.getTriCount = getTriCount;
	exports.getVertexCount = getVertexCount;
	exports.hashNumber = hashNumber;
	exports.hashRay = hashRay;
	exports.hashVertex2 = hashVertex2;
	exports.hashVertex3 = hashVertex3;
	exports.hashVertex4 = hashVertex4;
	exports.hasOverlaps = hasOverlaps;
	exports.isTriDegenerate = isTriDegenerate;
	exports.matchEdges = matchEdges;
	exports.toEdgeIndex = toEdgeIndex;
	exports.toNormalizedRay = toNormalizedRay;
	exports.toTriIndex = toTriIndex;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
