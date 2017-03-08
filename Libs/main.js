function community(filename) {
    /**
     * Created by vinhtngu on 3/6/17.
     */
    var width = 400, height = 300;
    var color = d3.scaleOrdinal(d3.schemeCategory20);
    var svg = d3.select("#community").append("svg").attr("width", width).attr("height", height);
    svg.append("rect")
    var simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(function (d) {
            return d.id;
        }))
        .force("charge", d3.forceManyBody().strength(-3))
        .force("center", d3.forceCenter(width / 2, height / 2));

    d3.json("data/" + filename + ".json", function (error, graph) {
        if (error) throw error;
        // console.log(rawdata)
        var node_ids = [];
        graph.nodes.forEach(function (d) {
            node_ids.push(Number(d.id));
        });
        var link_ids = [];
        graph.links.forEach(function (d) {
            link_ids.push({"source": +d.source, "target": +d.target, "weight": +d.weight});
        });
        var community = jLouvain().nodes(node_ids).edges(link_ids)();
        graph.nodes.forEach(function (d, i) {
            d.community = community[+d.id];
        });
        var groups = d3.nest()
            .key(function (d) {
                return d.community;
            })
            .entries(graph.nodes);

        var groupFill = function (d) {
            return color(d.community)
        };

        var link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(graph.links)
            .enter().append("line")
            .attr("stroke-width", 1);

        var node = svg.selectAll(".node")
            .data(graph.nodes)
            .enter().append("g")
            .attr("class", "node");

        node.append("circle")
            .attr("r", 5)
            .style("fill", function (d) {
                return color(d.community);
            }).on("mouseover", function (d) {

        })
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));


        // node.append("image")
        //     .attr("xlink:href", "https://github.com/favicon.ico")
        //     .attr("x", -8)
        //     .attr("y", -8)
        //     .attr("width", 16)
        //     .attr("height", 16);

        node.append("text")
            .attr("dx", 12)
            .attr("dy", ".35em")
            .text(function (d) {
                return d.name
            });

        simulation.on("tick", function () {
            link.attr("x1", function (d) {
                return d.source.x;
            })
                .attr("y1", function (d) {
                    return d.source.y;
                })
                .attr("x2", function (d) {
                    return d.target.x;
                })
                .attr("y2", function (d) {
                    return d.target.y;
                });

            node.attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")";
            });

        });
        simulation
            .nodes(graph.nodes);


        simulation.force("link")
            .links(graph.links);


    });

    function dragstarted(d) {
        if (!d3.event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }

    function dragended(d) {
        if (!d3.event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}
function communityV3(filename) {
    var width = 350,
        height = 400,
        fill = d3.scale.category20();
    var fisheye = d3.fisheye.circular()
        .radius(400)
        .distortion(2);
    var svg = d3.select("#community").append("svg")
        .attr("width", width)
        .attr("height", height);

    var force = d3.layout.force()
        .gravity(0.2)
        .distance(20)
        .charge(-100)
        .size([width, height]);

    d3.json("data/" + filename + ".json", function (error, graph) {
        if (error) throw error;
        //create Adjaacencylist


        var node_ids = [];
        graph.nodes.forEach(function (d) {
            node_ids.push(Number(d.id));
        });
        var link_ids = [];
        graph.links.forEach(function (d) {
            link_ids.push({"source": +d.source, "target": +d.target, "weight": +d.weight});
        });
        var community = jLouvain().nodes(node_ids).edges(link_ids)();
        graph.nodes.forEach(function (d, i) {
            d.community = community[+d.id];
        });
        var groups = d3.nest()
            .key(function (d) {
                return d.community;
            })
            .entries(graph.nodes);
        groups = groups.filter(function (d) {
            return d.values.length > 1;
        })
        var groupPath = function (d) {
            var fakePoints = [];
            if (d.values.length == 2) {
                //[dx, dy] is the direction vector of the line
                var dx = d.values[1].x - d.values[0].x;
                var dy = d.values[1].y - d.values[0].y;

                //scale it to something very small
                dx *= 0.00001;
                dy *= 0.00001;

                //orthogonal directions to a 2D vector [dx, dy] are [dy, -dx] and [-dy, dx]
                //take the midpoint [mx, my] of the line and translate it in both directions
                var mx = (d.values[0].x + d.values[1].x) * 0.5;
                var my = (d.values[0].y + d.values[1].y) * 0.5;
                fakePoints = [[mx + dy, my - dx],
                    [mx - dy, my + dx]];
                //the two additional points will be sufficient for the convex hull algorithm
            }
            //do not forget to append the fakePoints to the input data
            return "M" +
                d3.geom.hull(d.values.map(function (i) {
                    return [i.x, i.y];
                })
                    .concat(fakePoints))
                    .join("L")
                + "Z";
        }
        var groupFill = function (d, i) {
            return fill(+d.key);
        };
        for (var linkitem = 0; linkitem < graph.links.length; linkitem++) {
            for (var nodeItem = 0; nodeItem < graph.nodes.length; nodeItem++) {

                if (graph.nodes[nodeItem].id == graph.links[linkitem].source) {
                    graph.links[linkitem].source = nodeItem;
                }
                if (graph.nodes[nodeItem].id == graph.links[linkitem].target) {
                    graph.links[linkitem].target = nodeItem;
                }
            }
        }
        var adjList =[];
        graph.nodes.forEach(function (d,i) {
            adjList[i]=[];
        })
        graph.links.forEach(function (d) {
            adjList[d.source].push(d.target);
            adjList[d.target].push(d.source);

        });
        var betweenness = betweenness_centrality(adjList);
        selfareachart(betweenness);
        force
            .nodes(graph.nodes)
            .links(graph.links)
            .start();

        var link = svg.selectAll(".link")
            .data(graph.links)
            .enter().append("line")
            .attr("class", "link")
            .style("stroke", "gray")
            .style("stroke-width", 1);

        var node = svg.selectAll(".node")
            .data(graph.nodes)
            .enter().append("g")
            .attr("class", "node")
            .call(force.drag);

        node.append("circle")
            .attr("r", 5)
            .style("fill", function (d) {
                return fill(d.community);
            });

        node.append("text")
            .attr("dx", 12)
            .attr("dy", ".35em")
            .text(function (d) {
                return d.name + "--"+d.index;
            });

        force.on("tick", function () {
            link.attr("x1", function (d) {
                return d.source.x;
            })
                .attr("y1", function (d) {
                    return d.source.y;
                })
                .attr("x2", function (d) {
                    return d.target.x;
                })
                .attr("y2", function (d) {
                    return d.target.y;
                });

            node.attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")";
            });

            svg.selectAll("path")
                .data(groups)
                .attr("d", groupPath)
                .enter().append("path", "circle")
                .style("fill", groupFill)
                .style("stroke", groupFill)
                .style("stroke-width", 40)
                .style("stroke-linejoin", "round")
                .style("opacity", .2)
                .attr("d", groupPath);

        });
        // svg.on("mousemove", function () {
        //     fisheye.focus(d3.mouse(this));
        //
        //     node.each(function (d) {
        //         d.fisheye = fisheye(d);
        //     });
        //
        //     node.selectAll("circle")
        //         .attr("cx", function(d) { return d.fisheye.x - d.x; })
        //         .attr("cy", function(d) { return d.fisheye.y - d.y; })
        //         .attr("r", function(d) { return d.fisheye.z * d.r; });
        //
        //     node.selectAll("text")
        //         .attr("dx", function(d) { return d.fisheye.x - d.x; })
        //         .attr("dy", function(d) { return d.fisheye.y - d.y; });
        // });
    });

}
function selfareachart(betweenness){
    var dataArray = [33,44,74,65];
    console.log(Object.values(betweenness))
    var width = 350, height = 300;

    var x = d3.scale.linear()
        .domain([0, d3.max(dataArray)])
        .range([0, width]);

    var y = d3.scale.linear()
        .domain([0, d3.max(dataArray)])
        .range([height, 0]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");
    var area = d3.svg.area().interpolate("cardinal")
                 .x(function (d,i) {
                     return x(i*30);
                 })
        .y0(height)
        .y1(function (d) {
            return y(d);
        });
    var svg = d3.select("#selfarea").append("svg").attr("width", width).attr("height", height);
    svg.append('path').attr('d', area(dataArray));
}
function bubblechart() {
    var color = d3.scaleOrdinal(d3.schemeCategory20);
    var width = 500, height = 400;
    var simulation = d3.forceSimulation()
        .force("link", d3.forceLink())
        .force("charge", d3.forceManyBody().strength(-30))
        .force("center", d3.forceCenter(width / 2, height / 2));

    d3.json("data/bubble.json", function (error, data) {
        if (error) throw error;

        var cancerbyName = d3.nest()
            .key(function (d) {
                return d.study;
            })
            .entries(data.nodes);
        cancerbyName.forEach(function (d) {
            d.value = d.values.length;
            d.id = d.key;
        })
        var svgbubble = d3.select("#bubblechart")
            .append("svg")
            .attr("id", "svgbubble")
            .attr("width", width)
            .attr("height", height)
            .attr("class", "bubble");

        var node = svgbubble.selectAll(".node")
                .data(cancerbyName)
                .enter().append("g")
                .attr("class", "node")
            ;

        node.append("circle")
            .attr("r", 35)
            .attr("class", "cnode")
            .on("click", function (d) {
                alert("Here");
                community("Colorectal cancer")
            })
            .style("fill", function (d, i) {
                return color(i);
            }); //Added code;
        node.append("text")
            .style("class", "bubble")
            .attr("dx", 12)
            .attr("dy", ".35em")
            .style("font-size", "12px")
            .text(function (d) {
                return d.id
            });
        simulation.on("tick", function () {
            node.attr("transform", function (d) {
                return "translate(" + d.x + "," + d.y + ")";
            });
        });
        simulation
            .nodes(cancerbyName);
    })
}