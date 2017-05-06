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

    this.simulation = d3.forceSimulation()
        .force("collisionForce", d3.forceCollide(8).strength(1))
        .force("charge", d3.forceManyBody().strength(-2))
        .force("center", d3.forceCenter(
            (this.width / 2),
            (this.height / 2)
        ));


    // var attractForce = d3.forceManyBody().strength(80).distanceMax(400).distanceMin(80);
    // var collisionForce = d3.forceCollide(85).strength(1).iterations(100);

    this.clusterSimulation = d3.forceSimulation(this.clusters).alphaDecay(0.01)
        // .force("attractForce", attractForce)
        // .force("collisionForce", d3.forceCollide(85).strength(1).iterations(100))
        .force("charge", d3.forceManyBody().strength(0))
        .force("center", d3.forceCenter(
            (this.width / 2),
            (this.height / 2)
        ))
    ;


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

        // make sure each node has its cluster
        this.nodes.forEach(function (n) {

            if (!n.r) {
                n.r = 4;
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

        for(var cl in addedClusters) {
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
        this.clusterColors = newColors;

        var self = this;
        clusters.forEach(function (d) {
            // debugger;
            d.r = Math.min(40 + Math.round(40*Math.random()), (self.width - 30) /clusters.length);
        });

        // debugger;
        this.clusters = clusters;
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

    drawGraph: function() {
        this.drawClusters();
        this.drawNodes();
        this.drawLinks();
        this.createForceLayout();
    },

    drawClusters: function() {
        // let clusters = this.clusters.filter(c => c.length && !(c[0].isPainted && c[0].paintedCluster === undefined));
        let clusters = this.clusters;
        var self = this;

        function getFill(d) {
            return self.clusterColor(d[0].cluster);
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
            // .call(self.clusterSimulation.drag)
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
            })
        }
    },

    // draw nodes
    drawNodes: function() {
        // define dragging behavior
        var self = this;

        var handleDrageStarted = function dragstarted(d)
        {
            self.simulation.restart();
            self.simulation.alpha(1.0);
            d.fx = d.x;
            d.fy = d.y;
        };

        var handleDragged = function dragged(d)
        {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
        };

        var handleDraggedEnded = function dragended(d)
        {
            d.fx = null;
            d.fy = null;
            self.simulation.alphaTarget(0.1);
        };

        var myNodes = this.nodeGroup.selectAll(".data-node").data(this.nodes);


        myNodes.enter().append("circle")
                .attr("class", function (d) {
                    return "data-point data-node data-node-cluster-" + d.cluster;
                })
                .attr("r", d => d.r)
                .style("fill", function (d) {
                    return self.clusterColor(d.cluster);
                })
                .style("fill-opacity", 1)

                .call(d3.drag()
                    .on("start", handleDrageStarted)
                    .on("drag", handleDragged)
                    .on("end", handleDraggedEnded))
            ;

        myNodes.exit().remove();

        self.drawLinks();

        myNodes = self.nodeGroup.selectAll(".data-node");
        var myLinks = self.linkGroup.selectAll(".link");
        var circles = this.clusterCircleGroup.selectAll(".clusterCircle").filter(function (d) {
            debugger;
            return !!d;
        });
        var CLUSTER_RADIUS = 60;

        function innerNetworkTicked(){
            var handleCollision = function collide(alpha) {

                var nodeArr = self.clusters;
                var padding = 40;
                var clusterPadding = CLUSTER_RADIUS; // separation between different-color circles
                var quadtree = d3.quadtree()
                    .x(function (d) {
                        // cluster center x and y
                        d.x = d3.mean(d, function (innerNode) {
                            return innerNode.x;
                        });

                        d.x = Math.max(d.r, Math.min(self.width - d.r, d.x));


                        return d.x;
                    })
                    .y(function (d) {
                        d.y = d3.mean(d, function (innerNode) {
                            return innerNode.y;
                        });

                        d.y = Math.max(d.r, Math.min(self.height - d.r, d.y));


                        return d.y;
                    })
                    .addAll(nodeArr);

                return function(d) {

                    let x = d.x;
                    let y = d.y;
                    // compute cluster radius
                    // var radius = d3.max(d, (node) => {
                    //     return Math.sqrt(Math.pow((node.x - x), 2) + Math.pow((node.y - y), 2));
                    //     //  + radiusScale(node.hits);
                    // });

                    // d.r = 100;


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


            circles = circles.filter(function (d) {
                return d != null;
            });

            var updateCoordinates = handleCollision(.5);


            circles
                .each(function (d) {
                    if (d == null) {
                        debugger;
                        return;
                    }

                    updateCoordinates(d);
                })
                .attr("cx", function(d) {
                        if (d == null) {
                            debugger;
                            return 0;
                        }
                    //compute from all nodes within the cluster
                    // if(!!self.nodeGroup) {
                    //     d.x = d3.mean(d, function (innerNode) {
                    //         return innerNode.x;
                    //     });
                    // }
                    //
                    //
                    // d.x = Math.max(d.r, Math.min(self.width - d.r, d.x));

                    return d.x;
                })
                .attr("cy", function(d) {
                    if (d == null) {
                        debugger;
                        return 0;
                    }
                    // if(!!self.nodeGroup) {
                    //     d.y = d3.mean(d, function (innerNode) {
                    //         return innerNode.y;
                    //     });
                    // }
                    //
                    // d.y = Math.max(d.r, Math.min(self.height - d.r, d.y));

                    return d.y;
                })
                .attr("r", function (d) {
                    if (d == null) {
                        debugger;
                        return 0;
                    }
                    // var x = Number(d3.select(this).attr("cx"));
                    // var y = Number(d3.select(this).attr("cy"));
                    //
                    // var circlePadding = 10;
                    //
                    // var radius = d3.max(d, (node) => {
                    //     return Math.sqrt(Math.pow((node.x - x), 2) + Math.pow((node.y - y), 2));
                    //     //  + radiusScale(node.hits);
                    // });
                    //
                    // if (!radius) {
                    //     return 100;
                    // }
                    //
                    // d.r = radius + circlePadding;
                    // d.r = CLUSTER_RADIUS;

                    return d.r + 15;
                })

            ;

            myNodes
                .each(function (d) {
                    let cluster = self.clusters[d.cluster];
                    let distance = Math.sqrt(Math.pow((d.x - cluster.x), 2) + Math.pow((d.y - cluster.y), 2));
                    if (!!d.prex && (distance > (cluster.r - d.r))) {
                        d.x = d.prex;
                        d.y = d.prey;
                    }

                    d.x = Math.max(cluster.x - cluster.r + d.r, Math.min(cluster.x + cluster.r - d.r, d.x));
                    d.y = Math.max(cluster.y - cluster.r + d.r, Math.min(cluster.y + cluster.r - d.r, d.y));

                    d.prex = d.x;
                    d.prey = d.y;

                    // console.log(d);
                })
                .attr("cx", function(d){
                    // svg boundaries
                    d.x = Math.max(d.r, Math.min(self.height - d.r, d.x));

                    // cluster circle boundary:


                    return d.x;
                })
                .attr("cy", function(d){
                    // svg boundary
                    d.y = Math.max(d.r, Math.min(self.height - d.r, d.y));


                    return d.y;
                })
                .attr("r", function (d) {
                    return d.r;
                })
            ;

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
                var cluster = myCentroids[d.cluster];
                if (cluster === d) return;
                var x = d.x - cluster.x,
                    y = d.y - cluster.y,
                    l = Math.sqrt(x * x + y * y),
                    r = d.r + cluster.r;
                if (l !== r) {
                    l = (l - r) / l * alpha;
                    d.x -= x *= l;
                    d.y -= y *= l;
                    cluster.x += x;
                    cluster.y += y;
                }
            });
        };


        var link_force =  d3.forceLink(this.links)
                .id(function(d) {

                    return d.index;
                })
                // .distance((d) => {
                //
                //     // let strengthScale = d3.scaleLinear()
                //     //     .domain([0, self.maxValue])
                //     //     .range([1,0.4])
                //     //     .clamp(true);
                //     //
                //     // if (d.value < 0) {
                //     //     return 25/strengthScale(-d.value);
                //     // }
                //     // else {
                //     //     return 25*strengthScale(d.value);
                //     // }
                // })
            ;

        // var repaintClusterCircle = function (alpha) {
        //     if (!!alpha) {
        //         self.clusterSimulation.alphaTarget(alpha).restart();
        //     }
        //
        //     self.clusterCircleGroup.selectAll(".clusterCircle")
        //         .attr("cx", function (d) {
        //             if(!!self.nodeGroup) {
        //                 d.x = d3.mean(d, function (innerNode) {
        //                     return innerNode.x;
        //                 });
        //             }
        //
        //             // d.x = Math.max(d.r, Math.min(self.width - d.r, d.x));
        //
        //             return d.x;
        //         })
        //         .attr("cy", function (d) {
        //             if(!!self.nodeGroup) {
        //                 d.y= d3.mean(d, function (innerNode) {
        //                     return innerNode.y;
        //                 });
        //             }
        //
        //             // d.y = Math.max(d.r, Math.min(self.width - d.r, d.y));
        //
        //             return d.y;
        //         })
        //         .attr("r", function (d) {
        //             var x = Number(d3.select(this).attr("cx"));
        //             var y = Number(d3.select(this).attr("cy"));
        //
        //             var circlePadding = 10;
        //
        //             var radius = d3.max(d, (node) => {
        //                 return Math.sqrt(Math.pow((node.x - x), 2) + Math.pow((node.y - y), 2));
        //                 //  + radiusScale(node.hits);
        //             });
        //
        //             if (!radius) {
        //                 return 100;
        //             }
        //
        //             d.r = radius + circlePadding;
        //             // d.r = CLUSTER_RADIUS;
        //
        //             return d.r;
        //         })
        //
        //
        // };

        self.simulation
            .nodes(self.nodes)
            .force("cluster", clusterData)
            .force("links", link_force)
            // .force("collision", collide)
            .on("tick", innerNetworkTicked)
            .on("end", function () {

                // self.clusterSimulation.restart();
                // self.clusterSimulation.alpha(0.3);
                // repaintClusterCircle(0.3);

                if (!!self.endCb) {
                    self.endCb();
                }
            })
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