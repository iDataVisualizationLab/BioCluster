/**
 * This object requires to have "nodes" and "links"
 *
 * Each object link must have "source", "destination", "name" and either "weight" or "value" as numeric value
 *
 * @param args
 * @constructor
 */
function ClusterNetworkGraph(args) {
    Object.assign(this, args || ForceDirectedGraph.prototype);
    if (!this.options) {
        this.options = {};
    }

    this.init();
    // this.filterData(App.data);

    var sortedLinks = this.links.concat().sort((a, b) => {
        return Math.abs(b.value) - Math.abs(a.value);
    });

    this.maxValue = Math.abs(sortedLinks[0].value);


    // initialize color palette
    // let availableColors = ['#aec7e8','#ff7f0e','#ffbb78','#2ca02c','#98df8a','#d62728','#ff9896','#9467bd','#c5b0d5','#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'];
    var colorFunction = d3.scaleOrdinal(d3.schemeCategory10);
    let availableColors = [];

    for(var i =0; i< 10; i++) {
        availableColors.push(colorFunction(i));
    }

    this.colorPalette = {};
    this.clusterCentroids = {};

    for (let color of availableColors) {
        this.colorPalette[color] = {
            inUse: false,
            currentClusterNumber: -1
        };
    }

    this.defineClusters();

    // this.simulation = d3.forceSimulation()
    //     .force("collisionForce", d3.forceCollide(8).strength(1))
    //     .force("charge", d3.forceManyBody().strength(-2))
    //     .force("center", d3.forceCenter(
    //         (this.width / 2),
    //         (this.height / 2)
    //     ));


    // var attractForce = d3.forceManyBody().strength(80).distanceMax(400).distanceMin(80);
    // var collisionForce = d3.forceCollide(85).strength(1).iterations(100);

    // this.clusterSimulation = d3.forceSimulation(this.clusters).alphaDecay(0.01)
    //     // .force("attractForce", attractForce)
    //     // .force("collisionForce", d3.forceCollide(85).strength(1).iterations(100))
    //     .force("charge", d3.forceManyBody().strength(0))
    //     .force("center", d3.forceCenter(
    //         (this.width / 2),
    //         (this.height / 2)
    //     ))
    // ;


    // update graph
    this.drawGraph();
};


ClusterNetworkGraph.prototype = {
    constructor: ClusterNetworkGraph,
    // set up svg elements
    init: function () {
        // allows all work to be done using same coordinates initially used
        this.aspect = this.width / this.height;
        // this.width = 901;
        // this.height = this.width / this.aspect;

        // no need to redraw on resize
        this.svg.attr("viewBox", "0 0 " + this.width + " " + this.height);

        if (!!this.options.zoomEnabled) {
            this.svg.call(d3.zoom()
                .scaleExtent([1 / 2, 4])
                .on("zoom", this.zoomed.bind(this)))
                .on("dblclick.zoom", null)
            ;
        }


        // make sure each link has "value" property
        this.links.forEach(function (l) {
            if (!!l.value && !!l.weight) {
                return;
            }

            if (!!l.weight) {
                l.value = l.weight;
            }

            if (!l.value) {
                l.value = 1;
            }
        });

        var self = this;

        // make sure each node has its cluster
        this.nodes.forEach(function (n) {

            if (!n.r) {
                n.r = 4;
            }

            if (!n.x) {
                n.x = self.watch / 2;
            }

            if (!n.y) {
                n.y = self.height / 2;
            }

            if (!!n.cluster) {
                return;
            }

            n.cluster = n.community;


        });

        this.clusterCount = 1 + d3.max(this.nodes, function (d) {
                return d.cluster;
            });

        // colors from
        // http://colorbrewer2.org/#type=diverging&scheme=RdYlGn&n=9

        // stroke gradients
        function createSVGLinearGradient(colors, id, defs) {
            var left = defs.append('linearGradient')
                .attr('id', id + 'Left')
                .attr('x1', 1)
                .attr('y1', 0)
                .attr('x2', 0)
                .attr('y2', 0);

            for (var i = 0, il = colors.length - 1; i < il; ++i) {
                left.append('stop')
                    .attr('offset', Math.floor(i * 100 / il) + '%')
                    .attr('stop-color', colors[i]);
            }

            left.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', colors.pop());

            let xid = '#' + id + 'Left';
            defs.append('linearGradient')
                .attr('id', id + 'Right')
                .attr('xlink:href', xid)
                .attr('x1', 0)
                .attr('x2', 1)
            defs.append('linearGradient')
                .attr('id', id + 'Up')
                .attr('xlink:href', xid)
                .attr('x1', 0)
                .attr('y1', 1)
            defs.append('linearGradient')
                .attr('id', id + 'Down')
                .attr('xlink:href', xid)
                .attr('x1', 0)
                .attr('y2', 1)
        }

        var defs = this.svg.append('defs');

        if (!!this.options && !!this.options['linkColors']) {
            var linkColors = this.options['linkColors'];
            for (var type in linkColors) {
                if (!linkColors.hasOwnProperty(type)) {
                    continue;
                }

                createSVGLinearGradient([
                    linkColors[type],
                    '#222222'
                ], type, defs);

            }
        }

        this.clusterCircleGroup = this.svg.append("g")
            .attr("class", "clusterGroup");
        this.linkGroup = this.svg.append("g")
            .attr("class", "linkGroup");
        this.nodeGroup = this.svg.append("g")
            .attr("class", "nodeGroup");

        this._isDragging = false;

    },

    // cluster data based on threshold(s) of influence
    defineClusters: function(alpha) {

        let nodes = this.nodes;
        let clusters = [];
        let addedClusters = {};
        let tmpCluster;

        nodes.forEach(function (n) {
            if (!addedClusters.hasOwnProperty(n.cluster)) {
                addedClusters[n.cluster] = [];
                addedClusters[n.cluster].cluster = n.cluster;
            }

            tmpCluster =  addedClusters[n.cluster];
            let existed = false;
            for(var i =0; i< tmpCluster.length; i++) {
                if (tmpCluster[i] == n) {
                    existed = true;
                    break;
                }
            }

            if (!existed) {
                tmpCluster.push(n);
            }

        });

        for(let cl in addedClusters) {
            if (!addedClusters.hasOwnProperty(cl)) {
                continue;
            }

            clusters.push(addedClusters[cl]);
        }

        let newColors = new Array(clusters.length);
        for (let color = 0; color < clusters.length; color++) {
            newColors[color] = Object.keys(this.colorPalette)[color];
        }
        //
        // calculate radius:
        let maxNodeCount = d3.max(clusters, function (d) {
            return d.length;
        });

        // let minNodeCount = d3.min(clusters, function (d) {
        //     return d.length;
        // });

        var radiusScale = d3.scaleLinear()
            .domain([0, maxNodeCount])
            .range([30, 50]);
        clusters.forEach(function (d) {
            d.r = radiusScale(d.length);
        });

        debugger;
        this.clusters = clusters;
        this.clusterColors = newColors;

    },

    clusterColor: function(cluster) {

        return this.clusterColors[cluster];
    },

    stop: function () {
        if (this.simulation != null) {
            this.simulation.alphaTarget(0);
            this.simulation.stop();
        }

        if (this.clusterSimulation) {
            this.clusterSimulation.alphaTarget(0);
            this.clusterSimulation.stop();

        }
    },

    clear: function () {

        this.clusterCircleGroup.remove();
        this.linkGroup.remove();
        this.nodeGroup.remove();
        // this.svg.clear();

        this.nodes = [];
        this.links = [];
        this.clusters = [];
    },

    drawGraph: function() {
        let clusters = this.drawClusters();
        this.drawNodes(clusters);
        this.drawLinks();
        this.createForceLayout();
    },

    drawClusters: function() {

        var self = this;

        // let clusters = this.clusters.filter(c => c.length && !(c[0].isPainted && c[0].paintedCluster === undefined));
        let clusters = self.clusters;

        function getFill(d) {
            return self.clusterColor(d.cluster);
        }

        var circles = this.clusterCircleGroup.selectAll(".clusterCircle").data(clusters);


        circles
                .enter().append("circle")
                .attr("class", "clusterCircle")
                .style("fill", getFill)
                .style("stroke", getFill)
                .style("stroke-dasharray", "2, 2")
                .style("fill-opacity", 0.025)
                .call(d3.drag()
                    .on("start",dragstarted)
                    .on("drag",dragged)
                    .on("end",dragended))
        ;

        circles.exit().remove();



        function dragstarted(d)
        {
            if (!d3.event.active) {
                self.clusterSimulation.alphaTarget(0.3).restart();
                self.simulation.alphaTarget(0.3).restart();
            }

            d.fx = d.x;
            d.fy = d.y;

            d.forEach((n) => {
                n.fx = n.x;
                n.fy = n.y;
            });
        }

        function dragged(d)
        {
            d.fx += d3.event.dx;
            d.fy += d3.event.dy;

            d.forEach((n) => {
                n.fx += d3.event.dx;
                n.fy += d3.event.dy;
            });
        }

        function dragended(d)
        {
            if (!d3.event.active) {
                self.clusterSimulation.alphaTarget(0);
                self.simulation.alphaTarget(0);
            }

            d.fx = null;
            d.fy = null;

            d.forEach((n) => {
                n.fx = null;
                n.fy = null;
            });

        }



        circles = this.clusterCircleGroup.selectAll(".clusterCircle");

        var onTick = function () {
            var handleCollision = function collide(alpha) {

                var nodeArr = clusters;
                var padding = 40;
                var clusterPadding = 15; // separation between different-color circles
                var quadtree = d3.quadtree()
                    .x(function (d) {

                        // d.forEach(function (i) {
                        //    if (isNaN(i.x) ) {
                        //        i.x = self.width / 2;
                        //    }
                        // });
                        //
                        // // cluster center x and y
                        // d.x = d3.mean(d, function (innerNode) {
                        //     return innerNode.x;
                        // });
                        //
                        // if (isNaN(d.x)) {
                        //     debugger;
                        // }

                        // d.x = Math.max(d.r, Math.min(self.width - d.r, d.x));


                        return d.x;
                    })
                    .y(function (d) {

                        // d.forEach(function (i) {
                        //     if (isNaN(i.y)) {
                        //         i.y = self.height / 2;
                        //     }
                        // });
                        //
                        // d.y = d3.mean(d, function (innerNode) {
                        //     return innerNode.y;
                        // });
                        //
                        // if (isNaN(d.y)) {
                        //     debugger;
                        // }

                        // d.y = Math.max(d.r, Math.min(self.height - d.r, d.y));


                        return d.y;
                    })
                    .addAll(nodeArr);

                return function(d) {

                    let x = d.x;
                    let y = d.y;


                    // avoid collision
                    var r = d.r ,
                        nx1 = d.x - r,
                        nx2 = d.x + r,
                        ny1 = d.y - r,
                        ny2 = d.y + r;
                    quadtree.visit(function(quad, x1, y1, x2, y2) {

                        // debugger;
                        if (quad.data && (quad.data !== d)) {
                            var x = d.x - quad.data.x,
                                y = d.y - quad.data.y,
                                l = Math.sqrt(x * x + y * y),
                                r = d.r + quad.data.r + (d.cluster === quad.data.cluster ? padding : clusterPadding);
                            if (l < r) {
                                l = (l - r) / l * alpha;
                                d.x -= x *= l;
                                d.y -= y *= l;
                                quad.data.x += x;
                                quad.data.y += y;
                            }
                        }
                        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
                    });
                };
            };

            // from x and y of nodes, calculate cluster circle center
            var updateCoordinates = handleCollision(.5);


            circles
                .each(function (d) {
                    if (d == null || d == undefined) {
                        debugger;
                        return;
                    }

                    updateCoordinates(d);
                })
                .attr("cx", function(d) {

                    d.x = Math.max(d.r, Math.min(self.width - d.r, d.x));

                    return d.x;
                })
                .attr("cy", function(d) {


                    d.y = Math.max(d.r, Math.min(self.height - d.r, d.y));

                    return d.y;
                })
                .attr("r", function (d) {
                    if (d == null) {
                        debugger;
                        return 0;
                    }


                    return d.r + 5;
                })

            ;
        };


        self.clusterSimulation = d3.forceSimulation(clusters)
            .force("charge", d3.forceManyBody().strength(0))
            .force("center", d3.forceCenter(
                (this.width / 2),
                (this.height / 2)
            ))
            .on('tick', onTick)
        ;

        return clusters;

    },

    // draw nodes
    drawNodes: function(clusters) {
        // define dragging behavior
        var self = this;

        var myNodes = this.nodeGroup.selectAll(".data-node").data(this.nodes)
                .enter().append("circle")
                .attr("class", function (d) {
                    return "data-point data-node data-node-cluster-" + d.cluster;
                })
                .attr("r", d => d.r)
                .style("fill", function (d) {
                    return self.clusterColor(d.cluster);
                })
                .style("fill-opacity", 1)
            ;


        self.drawLinks();

        var myLinks = self.linkGroup.selectAll(".link");

        let circles = this.clusterCircleGroup.selectAll(".clusterCircle");


        function newX(d) {
            let cluster = clusters[d.cluster];
            let radius = cluster.r;
            let strokeWidth = 1;
            let hyp2 = Math.pow(radius, 2);

            let r = d.r;
            let curY = d.y;
            // force use of b coord that exists in circle to avoid sqrt(x<0)
            curY = Math.min(cluster.y + radius - r - strokeWidth, Math.max(cluster.y - radius + r + strokeWidth, curY));

            let b2 = Math.pow((curY - cluster.y), 2),
                a = Math.sqrt(hyp2 - b2);

            // radius - sqrt(hyp^2 - b^2) < coord < sqrt(hyp^2 - b^2) + radius
            let myX = d.x;
            myX = Math.max(cluster.x  - a + r + strokeWidth,
                Math.min(cluster.x + a - r - strokeWidth, myX));

            return myX;
        }

        function newY(d) {
            let cluster = clusters[d.cluster];
            let radius = cluster.r;
            let strokeWidth = 1;
            let hyp2 = Math.pow(radius, 2);

            let r = d.r;
            let curX = d.x;

            // force use of b coord that exists in circle to avoid sqrt(x<0)
            curX = Math.min(cluster.x + radius - r - strokeWidth, Math.max(cluster.x - radius + r + strokeWidth, curX));

            let b2 = Math.pow((curX - cluster.x), 2),
                a = Math.sqrt(hyp2 - b2);

            // radius - sqrt(hyp^2 - b^2) < coord < sqrt(hyp^2 - b^2) + radius
            let myY = d.y;
            myY = Math.max(cluster.y - a + r + strokeWidth, Math.min(cluster.y + a - r - strokeWidth, myY));

            return myY;
        }

        function innerNetworkTicked(){


            myNodes
                .attr("cx", function(d){

                    if(!d || !d.x) {
                        debugger;
                    }
                    // cluster circle boundary:
                    // d.x = cluster.x;
                    d.x = newX(d);



                    return d.x;
                })
                .attr("cy", function(d){
                    // svg boundary
                    let cluster = clusters[d.cluster];
                    d.y = newY(d);


                    return d.y;
                })
                .attr("r", function (d) {
                    return d.r;
                })
            ;

            // circles.attr("r", function (d) {
            //     let x = Number(d3.select(this).attr("cx"));
            //     let y = Number(d3.select(this).attr("cy"));
            //     let circlePadding = 5;
            //
            //     let radius = d3.max(d, (node) => {
            //         let d2 = Math.pow((node.x - x), 2) + Math.pow((node.y - y), 2);
            //
            //         return d2 > 0 ? Math.sqrt(d2) : 0;
            //     });
            //
            //     if (!radius) {
            //         radius = 30;
            //         // debugger;
            //     }
            //
            //     d.r = radius;
            //
            //
            //     return d.r + circlePadding;
            // });

            myLinks
                .style("stroke", (d) => {
                    if( !d ) {
                        return;
                    }

                    var dx = d.target.x - d.source.x,
                        dy = d.target.y - d.source.y;

                    if (!dx || !dy) {
                        return;
                    }

                    var type = d.type;

                    if (Math.abs(dy/dx) > 3) {
                        return dy < 0 ? "url(#" + type + "Up)" : "url(#" + type + "Down)";
                    }
                    return dx < 0 ? "url(#" + type + "Left)" : "url(#" + type + "Right)";

                })
                // .style("stroke", "black")

                .attr("x1", function(d) {
                    if (!d) {
                        return;
                    }
                    return d.source.x;
                })
                .attr("y1", function(d) {
                    if (!d) {
                        return;
                    }
                    return d.source.y;
                })
                .attr("x2", function(d) {
                    if (!d) {
                        return;
                    }
                    return d.target.x;
                })
                .attr("y2", function(d) {
                    if (!d) {
                        return;
                    }
                    return d.target.y;
                })
            // .attr('d', createArrowPath)
            ;
        }

        // @TODO: debug why this cause NaN sometimes
        var clusterData = function clusteringNetwork(alpha) {
            let myCentroids = [];
            let myCluster;
            for(var i=0; i< self.clusters.length; i++) {
                myCluster = self.clusters[i];

                if (myCluster.length < 1) {
                    continue;
                }

                // debugger;
                myCentroids.push(myCluster[0]);
            }

            self.nodes.forEach(function(d) {
                let cluster = myCentroids[d.cluster];
                if (cluster === d) return;

                if (!d.x || !d.y || !cluster.x || !cluster.y) {
                    return;
                }

                let x = d.x - cluster.x,
                    y = d.y - cluster.y;

                // avoid sqrt of zero
                if (x == 0 && y == 0) {
                    return;
                }

                let
                    l = Math.sqrt(x * x + y * y),
                    r = d.r + cluster.r;

                if (l !== r) {
                    l = (l - r) / l * alpha;
                    d.x -= x *= l;
                    d.y -= y *= l;
                    cluster.x += x;
                    cluster.y += y;
                }

                if (!d.x || !d.y || !cluster.x || !cluster.y) {
                    debugger;
                }
            });
        };


        var link_force =  d3.forceLink(this.links)
                .id(function(d) {

                    return d.index;
                })
            ;

        self.simulation = d3.forceSimulation(self.nodes)
            .force("center", d3.forceCenter(
                (this.width / 2),
                (this.height / 2)
            ))
            .force("cluster", clusterData)
            .force("links", link_force)
            .force("collisionForce", d3.forceCollide(8).strength(1))
            .force("charge", d3.forceManyBody().strength(-2))
            .on("tick", innerNetworkTicked)

        ;

    },

    drawLinks: function() {

        this.linkGroup.selectAll('.link-1')
            .data(this.links)
            .enter().append('line')
                .attr('class', 'link link-1')
                .attr('fill','none')
                .attr('pointer-events','none')
                .style('stroke-opacity', 1)
                // .style('stroke', 'black')
                .attr("value", d => d.value)
                .style("stroke-width", (d) => {
                    return 0.8;
                });
    },
    // the big workhorse of the simulation ???
    createForceLayout: function() {

    }, // end createForceLayout
};