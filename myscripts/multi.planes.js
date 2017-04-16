var mutiPlanes = {};
var multiPlaneRepresentationSvg;
var multiPlaneForceLayouts = {};

var SINGLE_NETWORK_WIDTH = 500;
var SINGLE_NETWORK_HEIGHT = 450;

var links = links || [];

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
};

mutiPlanes.init = function (originalLinks) {
    if (!originalLinks) {
        originalLinks = links;
    }

    this.clear();

    var curLink;
    for(var i = 0; i < originalLinks.length; i++) {
        curLink = originalLinks[i];

        if (!curLink) {
            continue;
        }

        this.createNetwork(mutiPlanes.speciesNetworks, curLink,  curLink.Context_Species);
        this.createNetwork(mutiPlanes.cellTypeNetworks, curLink, curLink.Context_CellType);

    }

    mutiPlanes.setup(1500, 600, SINGLE_NETWORK_WIDTH, SINGLE_NETWORK_HEIGHT);
};

mutiPlanes.createNetwork = function (networkContainer, link, contextContentArray) {

    if (!contextContentArray) {
        return;
    }

    var contextVal;
    var myContextNetwork;
    var addedLinks = {};
    var addedNodes = {};
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

            myContextNetwork.nodes.push(sourceNode);
            addedNodes[link.source.id] = sourceNode;
        }

        if (!addedNodes.hasOwnProperty(link.target.id)) {
            targetNode = new Object();
            targetNode.ref = link.target;
            targetNode.id = link.target.id;

            myContextNetwork.nodes.push(targetNode);
            addedNodes[link.target.id] = targetNode;
        }

        if (!addedLinks.hasOwnProperty(link.name)) {
            newLink = new Object();
            newLink.source = sourceNode;
            newLink.target = targetNode;
            newLink.name = link.name;

            myContextNetwork.links.push(newLink);
            addedLinks[link.name] = newLink;
        }
    }
};

mutiPlanes.setup = function (containerWidth, containerHeight, graphWidth, graphHeight) {
    var tmpNetwork;
    var mySvg ;
    var count = 0;
    for(var species in this.speciesNetworks)  {
        if (!this.speciesNetworks.hasOwnProperty(species)) {
            continue;
        }

        mySvg =  d3.select("#multi-plane-representation").append("svg")
            .attr("width", graphWidth)
            .attr("height", graphHeight);
        tmpNetwork = this.speciesNetworks[species];

        this.renderNetwork(mySvg, graphWidth, graphHeight, tmpNetwork);
        count ++;

        if (count >=1) {
            break;
        }

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

