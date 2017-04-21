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

mutiPlanes.setupContainer = function () {
    d3.select('body').select('#multi-plane-representation')
        .style("width", CONTAINER_WIDTH)
        .style("height", CONTAINER_HEIGHT)
    ;
};
mutiPlanes.clear = function () {
    d3.select("#multi-plane-representation").selectAll('*').remove();
    // this.setupContainer();
    // mutiPlanes.cellTypeNetworks = {};
    // mutiPlanes.speciesNetworks = {};
};

mutiPlanes.setSpeciesNetworks = function (speciesNetworks) {
    if (!speciesNetworks) {
        console.log("Invalid speciesNetwork. Expect array");
        return;
    }

    var singleSpeciesNetwork;
    for(var i=0; i< 5; i++) {
        if (i >= speciesNetworks.length) {
            break;
        }

        singleSpeciesNetwork = speciesNetworks[i];

        this.speciesNetworks[singleSpeciesNetwork.Context_Species] = this.createNodesAndLinks(singleSpeciesNetwork.list);
    }

};

mutiPlanes.setCellTypeNetworks = function (cellTypeNetworks) {
    if (!cellTypeNetworks) {
        console.log("Invalid cellTypeNetworks. Expect array");
        return;
    }

    var singleCellTypeNetwork;
    for(var i=0; i< 5; i++) {
        if (i >= cellTypeNetworks.length) {
            break;
        }

        singleCellTypeNetwork = cellTypeNetworks[i];

        this.cellTypeNetworks[singleCellTypeNetwork.Context_CellType] = this.createNodesAndLinks(singleCellTypeNetwork.list);
    }

};

mutiPlanes.setOrganNetworks = function (organNetworks) {
    if (!organNetworks) {
        console.log("Invalid organNetworks. Expect array");
        return;
    }

    var singleOrganNetwork;
    for(var i=0; i< 5; i++) {
        if (i >= organNetworks.length) {
            break;
        }

        singleOrganNetwork = organNetworks[i];

        this.cellTypeNetworks[singleOrganNetwork.Context_Organ] = this.createNodesAndLinks(singleOrganNetwork.list);
    }

};

/**
 *  Each network has a set of nodes and links. We have to create label for each node as well. Hence there are array of labelNodes and labelLinks for another force layout
 * @param links
 * @return {{nodes: Array, links: Array, labelNodes: Array, labelLinks: Array}}
 */
mutiPlanes.createNodesAndLinks = function (links) {
    var myNetwork = {
        nodes: [],
        links: [],
        labelNodes: [],
        labelLinks: []
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
            sourceNode.index = myNetwork.nodes.length;

            addedNodes[sourceNode.ref.id] = sourceNode;
            myNetwork.nodes.push(sourceNode);
        }
        else {
            sourceNode =  addedNodes[link.source.ref.id];
        }


        if (!addedNodes.hasOwnProperty(link.target.ref.id)) {
            targetNode = new Object();
            targetNode.ref = link.target.ref;
            targetNode.index = myNetwork.nodes.length;

            addedNodes[targetNode.ref.id] = targetNode;
            myNetwork.nodes.push(targetNode);
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

            myNetwork.links.push(myLink);

            addedLinks[myLink.name] = myLink;
        }


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


    this.renderContextNetworks(this.speciesNetworks, graphWidth, graphHeight, speciesMap);
    this.renderContextNetworks(this.cellTypeNetworks, graphWidth, graphHeight, celltypeMap);


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

    var forceLayout = d3.layout.force()
        .gravity(0.05)
        .linkDistance( 65 )
        .charge(-100)
        .size([svgWidth, svgHeight])
        .nodes(network.nodes)
        .links(network.links);

    // create links
    var myLink = svg.selectAll('.link')
        .data(network.links)
        .enter().append('line')
        .attr('class', 'link')
        .style("stroke", function(l){
            return getColor(l.type);
        })
        .style("stroke-opacity", 0.5)
        // .style("stroke-width",function(l){
        //     return 1+Math.sqrt(l.list.length-1);
        // })
        ;



    var myNode = svg.selectAll(".node")
        .data(network.nodes)
        .enter().append("g")
        .attr("class", "node")
        .call(forceLayout.drag);

    myNode.append('circle')
            .attr('r', 6)
            .style("fill", "#888")
            .style("stroke", "#000")
            .style("stroke-opacity", 1)
            .style("stroke-width", function(d) {
                return 1;
            })
        ;

    myNode.append("text")
        .attr("dx", 12)
        .attr("dy", ".35em")
        .text(function(d) {
            return d.ref.fields.entity_text ;
        });


    forceLayout.on("tick", function() {
        myLink.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        myNode.attr("transform", function(d) {
            var tX = Math.max(5, Math.min(svgWidth-5, d.x));
            var tY = Math.max(5, Math.min(svgHeight-5, d.y));
            return "translate(" + tX + "," + tY + ")";
        });
    });



    forceLayout.on('end', function() {

        // myNode.attr('r', 6)
        //     .attr('cx', function(d) { return d.x; })
        //     .attr('cy', function(d) { return d.y; });
        //
        // // We also need to update positions of the links.
        // // For those elements, the force layout sets the
        // // `source` and `target` properties, specifying
        // // `x` and `y` values in each case.
        //
        // myLink.attr('x1', function(d) { return d.source.x; })
        //     .attr('y1', function(d) { return d.source.y; })
        //     .attr('x2', function(d) { return d.target.x; })
        //     .attr('y2', function(d) { return d.target.y; });


        d3.select('body').selectAll("text.my-network-label")
            .attr("x", function () {
                var boxContainingText = this.getBBox();
                return (SINGLE_NETWORK_WIDTH - boxContainingText.width) / 2;
            });
    });

    forceLayout.start();
};

