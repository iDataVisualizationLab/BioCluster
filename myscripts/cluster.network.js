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
        .force("links",
            d3.forceLink()
                .id(d => d.index)
        )
        .force("collide", d3.forceCollide(10))
        .force("charge", d3.forceManyBody()
            .strength(-150)
            .distanceMax(Math.min(this.width, this.height)/4))
        .force("center", d3.forceCenter(
            (this.width / 2),
            (this.height / 2)
        ));

    // set up simulation
    // this.simulation = d3.forceSimulation()
    //     .force("links",
    //         d3.forceLink()
    //             .id(d => d.index)
    //     )
    //     .force("collide", d3.forceCollide(10))
    //     .force("charge", d3.forceManyBody()
    //         .strength(-150)
    //         .distanceMax(Math.min(this.width, this.height)/4))
    //     .force("center", d3.forceCenter(
    //         (this.width / 2),
    //         (this.height / 2)
    //     ));


    // update graph
    this.drawGraph();
};


ForceDirectedGraph.prototype = {
    constructor: ForceDirectedGraph,
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

            if (!n.radius) {
                n.radius = 4;
            }

            if (!n.x) {
                n.x = width / 2;
            }

            if (!n.y) {
                n.y = height / 2;
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
            .attr("class", "nodeGroup")

        this._isDragging = false;

    },

    drawGraph: function() {
        this.drawClusters();
        // this.drawNodes();
        // this.drawLinks();
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
        circles.enter().append("circle")
            .attr("class", "clusterCircle")
            .style("fill", getFill)
            // .style("fill", "none")
            .style("stroke", getFill)
            .style("stroke-dasharray", "2, 2")
            .style("fill-opacity", 0.025)
            .call(d3.drag()
                .on('start', function(d) {
                    if (!d3.event.active) {
                        self.simulation.alphaTarget(0.3).restart();
                    }
                    d.forEach((n) => {
                        n._fixed = (n.fx != null);
                        n.fx = n.x;
                        n.fy = n.y;
                    })
                })
                .on('drag', function(d) {
                    d.forEach((n) => {
                        n.fx += d3.event.dx;
                        n.fy += d3.event.dy;
                    })
                })
                .on('end', function(d) {
                    if (!d3.event.active) {
                        self.simulation.alphaTarget(0);
                    }

                }) )
            .on('click', function(d) {

            })
        ;

        circles.exit().remove();
    },

    // the big workhorse of the simulation ???
    createForceLayout: function() {

    }, // end createForceLayout
};