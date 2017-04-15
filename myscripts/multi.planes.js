var mutiPlanes = {};
var multiPlaneRepresentationSvg;
var multiPlaneForceLayouts = {};

mutiPlanes.speciesNetworks = {
    network1: {
        nodes: [],
        links: []
    },

    network2: {
        nodes: [],
        links: []
    }
};

mutiPlanes.cellTypeNetworks = {
    cellType1: {
        nodes: [],
        links: []
    },

    cellType2: {
        nodes: [],
        links: []
    }
};

mutiPlanes.init = function (containerWitth, containerHeight, graphWidth, graphHeight) {
    multiPlaneRepresentationSvg = d3.select("#container").append("svg")
        .attr("width", containerWitth)
        .attr("height", containerHeight);

    var tmpNetwork;
    for(var species in this.speciesNetworks) {
        if (!this.speciesNetworks.hasOwnProperty(species)) {
            continue;
        }

        tmpNetwork = this.speciesNetworks[species];

        this.renderNetwork(svg, graphWidth, graphHeight, tmpNetwork);

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
        .attr('class', 'node');

    forceLayout.on('end', function() {

        myNode.attr('r', svgWidth/25)
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