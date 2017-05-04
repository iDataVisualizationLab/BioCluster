var mutiPlanes = mutiPlanes || {};

var SINGLE_NETWORK_WIDTH = 340;
var SINGLE_NETWORK_HEIGHT = 360;
var CONTAINER_WIDTH = 2000;
var CONTAINER_HEIGHT = 1600;



mutiPlanes.speciesNetworks = {
    // network1: {
    //     nodes: [
    //         { x:   SINGLE_NETWORK_WIDTH/3, y: SINGLE_NETWORK_HEIGHT/2 },
    //         { x: 2*SINGLE_NETWORK_WIDTH/3, y: SINGLE_NETWORK_HEIGHT/2 }
    //     ],
    //     links: [
    //         { source: 0, target: 1 }
    //     ]
    // },
    //
    // network2: {
    //     nodes: [],
    //     links: []
    // }
};

mutiPlanes.cellTypeNetworks = {
    // cellType1: {
    //     nodes: [],
    //     links: []
    // },
    //
    // cellType2: {
    //     nodes: [],
    //     links: []
    // }
};


mutiPlanes.organNetworks = {
    // organ1: {
    //     nodes: [],
    //     links: []
    // },
    //
    // organ2: {
    //     nodes: [],
    //     links: []
    // }
};

mutiPlanes.interactionTypeNetworks = {
    // organ1: {
    //     nodes: [],
    //     links: []
    // },
    //
    // organ2: {
    //     nodes: [],
    //     links: []
    // }
};

mutiPlanes.setupContainer = function () {
    d3.select('body').select('#multi-plane-representation')
        .style("width", CONTAINER_WIDTH)
        .style("height", CONTAINER_HEIGHT)
    ;
};
mutiPlanes.clear = function () {
    d3.select("#multi-plane-representation").selectAll('*').remove();
};

mutiPlanes.setSpeciesNetworks = function (speciesNetworks) {
    this.speciesNetworks = this.setupNetworks(speciesNetworks, "Context_Species");
};

mutiPlanes.setCellTypeNetworks = function (cellTypeNetworks) {
    this.cellTypeNetworks = this.setupNetworks(cellTypeNetworks, "Context_CellType");
};

mutiPlanes.setOrganNetworks = function (organNetworks) {
    this.organNetworks = this.setupNetworks(organNetworks, "Context_Organ");
};


mutiPlanes.setInteractionTypeNetworks = function (interactionTypeNetworks) {
    this.interactionTypeNetworks = this.setupNetworks(interactionTypeNetworks, "type");
};

mutiPlanes.setupNetworks = function (originalNetworks, type) {
    if (!originalNetworks) {
        console.log("Invalid network. Expect array");
        return;
    }

    var result = {};
    var singleNetwork;
    for(var i=0; i< 5; i++) {
        if (i >= originalNetworks.length) {
            break;
        }

        singleNetwork = originalNetworks[i];

        result[singleNetwork[type]] = this.createNodesAndLinks(singleNetwork.list);
    }

    return result;
};


/**
 *  Each network has a set of nodes and links. We have to create label for each node as well. Hence there are array of labelNodes and labelLinks for another force layout
 * @param links
 * @return {{nodes: Array, links: Array}}
 */
mutiPlanes.createNodesAndLinks = function (links) {
    var myNetwork = {
        nodes: [],
        nodeIds: [], // for community detection
        links: [],
        communityCount: 0
    };

    if (!links || links.length < 1) {
        return myNetwork;
    }

    var link;

    var sourceNode;
    var targetNode;
    var addedNodes = {};
    var addedLinks = {};
    var myLink = {};

    for(var i=0; i< links.length; i++) {
        link = links[i];

        if (!addedNodes.hasOwnProperty(link.source.ref.id)) {
            sourceNode = new Object();
            sourceNode.ref = link.source.ref;
            sourceNode.name = link.source.ref.fields.entity_text;
            sourceNode.index = myNetwork.nodes.length;

            addedNodes[sourceNode.ref.id] = sourceNode;
            myNetwork.nodes.push(sourceNode);
            myNetwork.nodeIds.push(sourceNode.index);
        }
        else {
            sourceNode =  addedNodes[link.source.ref.id];
        }


        if (!addedNodes.hasOwnProperty(link.target.ref.id)) {
            targetNode = new Object();
            targetNode.ref = link.target.ref;
            targetNode.index = myNetwork.nodes.length;
            targetNode.name = link.target.ref.fields.entity_text;

            addedNodes[targetNode.ref.id] = targetNode;
            myNetwork.nodes.push(targetNode);
            myNetwork.nodeIds.push(targetNode.index);

        }
        else {
            targetNode =  addedNodes[link.target.ref.id];
        }

        // handling links
        if (!addedLinks.hasOwnProperty(sourceNode.index + '-' + targetNode.index)) {
            myLink = new Object();
            myLink.name = sourceNode.index + '-' + targetNode.index;
            myLink.source = sourceNode.index;
            myLink.target = targetNode.index;
            myLink.type = link.ref.type;
            myLink.weight = 1;

            myNetwork.links.push(myLink);

            addedLinks[myLink.name] = myLink;
        }


    }

    var community = jLouvain().nodes(myNetwork.nodeIds).edges(myNetwork.links);
    var community_assignment_result = community();
    var max_community_number = 0;
    for(var i=0; i< myNetwork.nodes.length; i++) {
        myNetwork.nodes[i].community = community_assignment_result[i];
        max_community_number = max_community_number < community_assignment_result[i] ? community_assignment_result[i]: max_community_number;
    }

    if (myNetwork.nodes.length > 0) {
        myNetwork.communityCount = max_community_number + 1;
    }

    return myNetwork;

};

mutiPlanes.renderContextNetworks = function (contextNetworks, graphWidth, graphHeight, textMapping) {
    var tmpNetwork;
    var mySvg ;
    var text;
    for(var key in contextNetworks)  {
        if (!contextNetworks.hasOwnProperty(key)) {
            continue;
        }

        text = getContextFromID(key, textMapping);
        console.log("Species is: " + text);
        tmpNetwork = contextNetworks[key];

        mySvg =  d3.select("#multi-plane-representation").append("svg")
            .attr("class", "context-network-class")
            .attr("width", graphWidth)
            .attr("height", graphHeight)
        ;

        // border for svg
        mySvg.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("height", graphHeight)
            .attr("width", graphWidth)
            .style("stroke", '#000000')
            .style("fill", "none")
            .style("stroke-width", 1);

        this.renderNetwork(mySvg, graphWidth, graphHeight, tmpNetwork);

        mySvg.append('text')
            .attr('class', "my-network-label")
            .text(text)
            .attr("y", graphHeight - 3)
            .attr("x", (graphWidth - 8) / 2)
        ;

        // break;
    }
};

mutiPlanes.runNetwork = function (graphWidth, graphHeight) {


    if (!graphWidth) {
        graphWidth = SINGLE_NETWORK_WIDTH;
    }

    if (!graphHeight) {
        graphHeight = SINGLE_NETWORK_HEIGHT;
    }

    console.log("Run and display the network ");


    this.renderContextNetworks(this.interactionTypeNetworks, graphWidth, graphHeight, {});
    // d3.select("#multi-plane-representation").append("br");
    // this.renderContextNetworks(this.speciesNetworks, graphWidth, graphHeight, speciesMap);
    // d3.select("#multi-plane-representation").append("br");
    //
    // this.renderContextNetworks(this.cellTypeNetworks, graphWidth, graphHeight, celltypeMap);
    // d3.select("#multi-plane-representation").append("br");
    //
    // this.renderContextNetworks(this.organNetworks, graphWidth, graphHeight, organMap);
    // d3.select("#multi-plane-representation").append("br");


};

mutiPlanes.printNetwork = function (network) {

    console.log("**** links ****");
    var l;
    for(var i=0; i< network.links.length; i++) {
        l = network.links[i];
        console.log("Link '" + l.name + "; source=" + l.source + "; target=" + l.target);
    }

    console.log("*** nodes ***")
    var n;
    for(var i=0; i< network.nodes.length; i++) {
        n = network.nodes[i];
        console.log("node '" + n.id);
    }
};

 mutiPlanes.renderNetwork = function (svg, svgWidth, svgHeight, network) {

     var cb = function () {
         d3.select('body')
             .selectAll("text.my-network-label")
             .attr("x", function () {
                 var boxContainingText = this.getBBox();
                 return (SINGLE_NETWORK_WIDTH - boxContainingText.width) / 2;
             });
     };

     // var fd = new ForceDirectedGraph( {
     //     svg: svg,
     //     width: svgWidth,
     //     height: svgHeight,
     //     nodes: network.nodes,
     //     links: network.links,
     //     options: {
     //         linkColors: getLinkColorMapping()
     //     },
     //     ontickCallback: cb,
     //     simulationEndCallback: cb
     // });

     var fd2 = new ClusterNetworkGraph( {
         svg: svg,
         width: svgWidth,
         height: svgHeight,
         nodes: network.nodes,
         links: network.links,
         options: {
             linkColors: getLinkColorMapping()
         },
         ontickCallback: cb,
         simulationEndCallback: cb
     });
 };

//
// mutiPlanes.renderNetwork = function (svg, svgWidth, svgHeight, network) {
//
//     this.renderClusterBoundaries(svg, svgWidth, svgHeight, network);
//
//
//     var forceLayout = d3.layout.force()
//         .gravity(0.05)
//         .linkDistance( 65 )
//         .charge(-100)
//         .size([svgWidth, svgHeight])
//         .nodes(network.nodes)
//         .links(network.links);
//
//     // create links
//     var myLink = svg.selectAll('.link')
//         .data(network.links)
//         .enter().append('line')
//         .attr('class', 'link')
//         .style("stroke", function(l){
//             return getColor(l.type);
//         })
//         .style("stroke-opacity", 0.5)
//         // .style("stroke-width",function(l){
//         //     return 1+Math.sqrt(l.list.length-1);
//         // })
//         ;
//
//
//
//     var myNode = svg.selectAll(".node")
//         .data(network.nodes)
//         .enter().append("g")
//         .attr("class", "node")
//         .call(forceLayout.drag);
//
//     myNode.append('circle')
//             .attr('r', 6)
//             .style("fill", "#888")
//             .style("stroke", "#000")
//             .style("stroke-opacity", 1)
//             .style("stroke-width", function(d) {
//                 return 1;
//             })
//         ;
//
//     myNode.append("text")
//         .attr("dx", 12)
//         .attr("dy", ".35em")
//         .text(function(d) {
//             return d.ref.fields.entity_text ;
//         });
//
//
//     forceLayout.on("tick", function(e) {
//         // console.log("My alpha: " + e.alpha);
//         myLink.attr("x1", function(d) { return d.source.x; })
//             .attr("y1", function(d) { return d.source.y; })
//             .attr("x2", function(d) { return d.target.x; })
//             .attr("y2", function(d) { return d.target.y; });
//         //
//         // myNode.attr("transform", function(singleNode) {
//         //
//         //     var tX = Math.max(5, Math.min(svgWidth-5, singleNode.x));
//         //     var tY = Math.max(5, Math.min(svgHeight-5, singleNode.y));
//         //
//         //
//         //     return "translate(" + tX + "," + tY + ")";
//         // });
//
//         // myNode.attr("transform", function(singleNode) {
//         //     var clusterCircle = mutiPlanes.getClusterCircleForNetwork(network, svgWidth, svgHeight, singleNode.community);
//         //     var tX = Math.max(clusterCircle.cx - clusterCircle.radius + 6, Math.min(clusterCircle.cx + clusterCircle.radius - 6, singleNode.x));
//         //     var tY = Math.max(clusterCircle.cy - clusterCircle.radius + 6, Math.min(clusterCircle.cy + clusterCircle.radius - 6, singleNode.y));
//         //
//         //
//         //     return "translate(" + tX + "," + tY + ")";
//         // });
//
//         myNode
//             .each(function (singleNode) {
//                 var alpha = .2 * e.alpha;
//                 var clusterCircle = mutiPlanes.getClusterCircleForNetwork(network, svgWidth, svgHeight, singleNode.community);
//
//                 var newY = singleNode.y + (clusterCircle.cy - singleNode.y) * alpha;
//                 var newX = singleNode.x + (clusterCircle.cx - singleNode.x) * alpha;
//
//                 singleNode.y = newY;
//                 singleNode.x = newX;
//
//                 // var x = newX - clusterCircle.cx;
//                 // var y = newY - clusterCircle.cy;
//                 // var distance = Math.sqrt(x*x + y*y);
//                 //
//                 // if (distance <= clusterCircle.radius - 6) {
//                 //     singleNode.y = newY;
//                 //     singleNode.x = newX;
//                 // }
//
//                 // var minRec =
//                 //
//                 // var tX = Math.max(clusterCircle.cx - clusterCircle.radius + 6, Math.min(clusterCircle.cx + clusterCircle.radius - 6, singleNode.x));
//                 // var tY = Math.max(clusterCircle.cy - clusterCircle.radius + 6, Math.min(clusterCircle.cy + clusterCircle.radius - 6, singleNode.y));
//                 //
//                 // singleNode.x = tX;
//                 // singleNode.y = tY;
//
//             })
//             .attr('transform', function (d) {
//                 return "translate(" + d.x + "," + d.y + ")";
//             })
//             .attr("x", function(d) { return d.x; })
//             .attr("y", function(d) { return d.y; })
//         ;
//
//
//
//
//         // myNode
//         //     .each(function (singleNode) {
//         //             var clusterCircle = mutiPlanes.getClusterCircleForNetwork(network, svgWidth, svgHeight, singleNode.community);
//         //             var tX = Math.max(clusterCircle.cx - clusterCircle.radius + 6, Math.min(clusterCircle.cx + clusterCircle.radius - 6, singleNode.x));
//         //             var tY = Math.max(clusterCircle.cy - clusterCircle.radius + 6, Math.min(clusterCircle.cy + clusterCircle.radius - 6, singleNode.y));
//         //             singleNode.x = tX;
//         //             singleNode.y = tY;
//         //     })
//         //     .attr("cx", function(d) { return d.x; })
//         //     .attr("cy", function(d) { return d.y; });
//     });
//
//
//
//     forceLayout.on('end', function() {
//         d3.select('body').selectAll("text.my-network-label")
//             .attr("x", function () {
//                 var boxContainingText = this.getBBox();
//                 return (SINGLE_NETWORK_WIDTH - boxContainingText.width) / 2;
//             });
//     });
//
//
//     forceLayout.start();
// };
//
// mutiPlanes.getClusterCircleForNetwork = function (network, svgWidth, svgHeight, communityIndex) {
//     switch (network.communityCount) {
//         case 1:
//             return {cx: svgWidth / 2, cy: svgHeight / 2, radius: svgWidth/2 - 10};
//         case 2:
//             if (communityIndex == 0) {
//                 return {cx: svgWidth / 4, cy: svgHeight / 4, radius: Math.min(svgWidth, svgHeight) / 4  - 2}
//             }
//             else {
//                 return {cx: svgWidth * 3 / 4, cy: svgHeight*3 / 4, radius: Math.min(svgWidth, svgHeight) / 4  - 2}
//             }
//
//             break;
//         case 3:
//             if (communityIndex == 0) {
//                 return {cx: svgWidth / 4, cy: svgHeight / 4, radius: Math.min(svgWidth, svgHeight) / 4  - 2}
//             }
//             else if (communityIndex == 1) {
//                 return {cx: svgWidth * 2 / 4, cy: svgHeight*2 / 4, radius: Math.min(svgWidth, svgHeight) / 4  - 2}
//             }
//             else {
//                 return {cx: svgWidth / 4, cy: svgHeight*3 / 4, radius: Math.min(svgWidth, svgHeight) / 4  - 2}
//             }
//             break;
//         case 4:
//             if (communityIndex == 0) {
//                 return {cx: svgWidth / 4, cy: svgHeight / 4, radius: Math.min(svgWidth, svgHeight) / 4  - 2}
//             }
//             else if (communityIndex == 1) {
//                 return {cx: svgWidth * 2 / 4, cy: svgHeight*2 / 4, radius: Math.min(svgWidth, svgHeight) / 4  - 2}
//             }
//             else if (communityIndex == 2) {
//                 return {cx: svgWidth / 4, cy: svgHeight*3 / 4, radius: Math.min(svgWidth, svgHeight) / 4  - 2}
//             }
//             else {
//                 return {cx: svgWidth * 3 / 4, cy: svgHeight*3 / 4, radius: Math.min(svgWidth, svgHeight) / 4  - 2}
//             }
//     }
//
//     // 1 community
//     return {cx: svgWidth / 2, cy: svgHeight / 2, radius: svgWidth/2 - 2};
// };

// mutiPlanes.renderClusterBoundaries = function (svg, svgWidth, svgHeight, network) {
//     var clusterCircle;
//
//     var colors = d3.scale.category10();
//
//     for(var i=0; i< network.communityCount; i++) {
//         clusterCircle = this.getClusterCircleForNetwork(network, svgWidth, svgHeight, i);
//
//         if (!clusterCircle) {
//             console.log("Error in getting getClusterCenterForNetwork");
//             continue;
//         }
//
//         svg.append('circle')
//             .attr('r', clusterCircle.radius)
//             .attr('cx', clusterCircle.cx)
//             .attr('cy', clusterCircle.cy)
//             .style("fill", colors(i))
//             .style("fill-opacity", 0.5)
//             // .style("stroke", "#000")
//             // .style("stroke-opacity", 1)
//             // .style("stroke-width",1)
//         ;
//
//         // break;
//     }
// };
