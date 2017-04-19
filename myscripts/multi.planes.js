var mutiPlanes = mutiPlanes || {};
var multiPlaneRepresentationSvg;
var multiPlaneForceLayouts = {};

var SINGLE_NETWORK_WIDTH = 500;
var SINGLE_NETWORK_HEIGHT = 450;
var CONTAINER_WIDTH = 1500;
var CONTAINER_HEIGHT = 600;

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


mutiPlanes.clear = function () {
    d3.select("#multi-plane-representation").selectAll('*').remove();

    // mutiPlanes.cellTypeNetworks = {};
    // mutiPlanes.speciesNetworks = {};
};

mutiPlanes.setSpeciesNetwork = function (speciesNetworks) {
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

mutiPlanes.createNodesAndLinks = function (links) {
    var myNetwork = {
        nodes: [],
        links: []
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

            myNetwork.links.push(myLink);

            addedLinks[myLink.name] = myLink;
        }


    }

    return myNetwork;

};

mutiPlanes.init = function (originalLinks) {
    if (!originalLinks) {
        originalLinks = links;
    }

    this.clear();

    var curLink;
    var excludedNodes = {};
    var excludedLinks = {};
    var excludedCellTypeNodes = {};
    var excludedCellTypeLinks = {};

    for(var i = 0; i < originalLinks.length; i++) {
        curLink = originalLinks[i];

        if (!curLink || !curLink.source || !curLink.target) {
            console.log("Not a valid link: " + curLink.name);
            continue;
        }

        this.createNetwork(mutiPlanes.speciesNetworks, curLink,  curLink.Context_Species, excludedNodes, excludedLinks);
       // this.createNetwork(mutiPlanes.cellTypeNetworks, curLink, curLink.Context_CellType, excludedCellTypeNodes, excludedCellTypeLinks);

    }

    mutiPlanes.runNetwork(CONTAINER_WIDTH, CONTAINER_HEIGHT, SINGLE_NETWORK_WIDTH, SINGLE_NETWORK_HEIGHT);
};

mutiPlanes.createNetwork = function (networkContainer, link, contextContentArray, excludeNodes, excludeLinks) {

    if (!contextContentArray) {
        return;
    }

    var contextVal;
    var myContextNetwork;
    var addedLinks = excludeLinks;
    var addedNodes = excludeNodes;
    var sourceNode;
    var targetNode;
    var newLink;
    for(var i = 0; i < contextContentArray.length; i++) {
        contextVal = contextContentArray[i];
        if (!networkContainer.hasOwnProperty(contextVal)) {
            networkContainer[contextVal] = {
                nodes: [],
                links: []
            };
        }

        myContextNetwork = networkContainer[contextVal];

        if (!addedNodes.hasOwnProperty(link.source.id)) {
            sourceNode = new Object();
            sourceNode.ref = link.source;
            sourceNode.id = link.source.id;
            sourceNode.index = myContextNetwork.nodes.length;

            myContextNetwork.nodes.push(sourceNode);
            addedNodes[sourceNode.id] = sourceNode;
        }
        else {
            sourceNode = addedNodes[link.source.id];
        }

        if (!addedNodes.hasOwnProperty(link.target.id)) {
            targetNode = new Object();
            targetNode.ref = link.target;
            targetNode.id = link.target.id;
            targetNode.index = myContextNetwork.nodes.length;


            myContextNetwork.nodes.push(targetNode);
            addedNodes[targetNode.id] = targetNode;
        }
        else {
            targetNode = addedNodes[link.target.id];
        }

        if (!addedLinks.hasOwnProperty(link.name)) {
            newLink = new Object();
            newLink.source = sourceNode.index;
            newLink.target = targetNode.index;
            newLink.name = link.name;

            myContextNetwork.links.push(newLink);
            addedLinks[link.name] = newLink;
        }
    }
};

mutiPlanes.runNetwork = function (containerWidth, containerHeight, graphWidth, graphHeight) {

    if (!containerWidth) {
        containerWidth = CONTAINER_WIDTH;
    }

    if (!containerHeight) {
        containerHeight = CONTAINER_HEIGHT;
    }

    if (!graphWidth) {
        graphWidth = SINGLE_NETWORK_WIDTH;
    }

    if (!graphHeight) {
        graphHeight = SINGLE_NETWORK_HEIGHT;
    }

    console.log("Run and display the network ");


    var tmpNetwork;
    var mySvg ;
    var count = 0;
    var sp;
    for(var species in this.speciesNetworks)  {
        if (!this.speciesNetworks.hasOwnProperty(species)) {
            continue;
        }

        sp = getContextFromID(species, speciesMap);
        console.log("Species is: " + sp);
        tmpNetwork = this.speciesNetworks[species];
        // if (!sp || tmpNetwork.nodes.length < 10) {
        //     continue;
        // }

        if (!this.displayable(sp)) {
            continue;
        }

        console.log("*** displaying Transgenic mices network ****");
        // debugger;
        this.printNetwork(tmpNetwork);

        mySvg =  d3.select("#multi-plane-representation").append("svg")
            .attr("width", graphWidth)
            .attr("height", graphHeight);

        this.renderNetwork(mySvg, graphWidth, graphHeight, tmpNetwork);

        mySvg.append('text')
            .text(sp)
            .attr("y", graphHeight - 3)
            .attr("x", graphWidth / 2)
        ;
        count ++;

    }

};

mutiPlanes.displayable = function (item) {

  // return item == 'Transgenic mices'  || item == 'women' || item == 'Mouse';
  return true;
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
        .size([svgWidth, svgHeight])
        .nodes(network.nodes)
        .links(network.links);

    forceLayout.linkDistance(svgWidth/2);

    // create links
    var myLink = svg.selectAll('.link')
        .data(network.links)
        .enter().append('line')
        .attr('class', 'link');


    var myNode = svg.selectAll('.node')
        .data(network.nodes)
        .enter().append('circle')
        // .attr('class', 'node')
            .style("fill", "#888")
            .style("stroke", "#000")
            .style("stroke-opacity", 1)
            .style("stroke-width", function(d) {
                return 1;
            })
        ;

    forceLayout.on('end', function() {

        myNode.attr('r', 6)
            .attr('cx', function(d) { return d.x; })
            .attr('cy', function(d) { return d.y; });

        // We also need to update positions of the links.
        // For those elements, the force layout sets the
        // `source` and `target` properties, specifying
        // `x` and `y` values in each case.

        myLink.attr('x1', function(d) { return d.source.x; })
            .attr('y1', function(d) { return d.source.y; })
            .attr('x2', function(d) { return d.target.x; })
            .attr('y2', function(d) { return d.target.y; });

    });

    forceLayout.start();
};

