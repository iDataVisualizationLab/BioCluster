var App = App || {};

/**
 * This object requires to have "nodes" and "links"
 *
 * Each object link must have "source", "destination", "name" and either "weight" or "value" as numeric value
 *
 * @param args
 * @constructor
 */
function ForceDirectedGraph(args) {
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

  let self = this;

  // set up simulation
    this.simulation = d3.forceSimulation(self.nodes)
        .force("charge", d3.forceManyBody().strength(-0.4))
        .force("center", d3.forceCenter(self.width / 2, self.height / 2))
    ;

    var endCb = self.simulationEndCallback ? self.simulationEndCallback : null;
    if (!!endCb) {
        this.simulation
            .on("end", function () {
                if (!!endCb) {
                    endCb();
                }
            })
        ;
    }


    //
    // this.clusterSimulation = d3.forceSimulation(self.clusters)
    // // .force("links", link_force)
    //     .force("collision", d3.forceCollide(8))
    //     .force("charge", d3.forceManyBody().strength(-0.4))
    //     .force("center", d3.forceCenter(self.width / 2, self.height / 2));
    // update graph
  this.drawGraph();
};

ForceDirectedGraph.prototype = {
  constructor:ForceDirectedGraph,
  // set up svg elements
  init: function() {
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

    let self = this;

    let radius = this.getNodeRadius();
    // make sure each node has its cluster
    this.nodes.forEach(function (n) {

        if (!n.radius) {
            n.radius = radius;
        }

        // if (!n.x) {
        //     n.x = self.width / 2;
        // }
        //
        // if (!n.y) {
        //     n.y = self.height / 2;
        // }

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
        .attr('id',id + 'Left')
        .attr('x1',1)
        .attr('y1',0)
        .attr('x2',0)
        .attr('y2',0);

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
          .attr('x1',0)
          .attr('x2',1);
      defs.append('linearGradient')
          .attr('id', id + 'Up')
          .attr('xlink:href', xid)
          .attr('x1',0)
          .attr('y1',1);
      defs.append('linearGradient')
          .attr('id', id + 'Down')
          .attr('xlink:href', xid)
          .attr('x1',0)
          .attr('y2',1);
    }

    var defs = this.svg.append('defs');

    if (!!this.options && !!this.options['linkColors'] ) {
        var linkColors = this.options['linkColors'];
        for(var type in linkColors) {
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

    /* Initialize tooltip for nodes */
    this.tip = d3.select('#forceDirectedDiv').append('div').attr('id', 'tip');
  },

    getLinkDistance: function () {
      let distance = 20;
      let self = this;
      if (!isNaN(this.options.maxNodeCount) && this.options.maxNodeCount > 0) {
          let min = Math.min(self.width, self.height);
          distance = min / Math.sqrt(this.options.maxNodeCount);
      }

      return distance * 0.8;
    },

    getNodeRadius: function () {
        let radius = this.getLinkDistance() / 10;
      return radius < 2 ? 2 : radius;
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
    this.clusters = clusters;

  },
    
    computeCentroid: function (cluster) {
      let myNodes = this.nodes.filter(function (d) {
         return d.cluster == cluster;
      });

      let x = d3.mean(myNodes, function (d) {
            return d.x;
        });


        let y = d3.mean(myNodes, function (d) {
            return d.x;
        });

        return {x: x, y: y};
    },

    highLightNode: function (d) {
      console.log("Highlight for node: " + d.ref.id);

      this.nodeGroup.selectAll(".data-node")
          .style("opacity", function (i) {
              return d.ref.id == i.ref.id ? 1 : 0.2;
          });

      this.linkGroup.selectAll(".link-1")
          .style("opacity", 0.2);
    },

    clearHighlight: function (d) {
        this.nodeGroup.selectAll(".data-node")
            .style("opacity", 1);
        this.linkGroup.selectAll(".link-1")
            .style("opacity", 1);
    },
  // update function
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

    //
    // circles
    //   .style("fill", getFill)
    //   .style("stroke", getFill);

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

            d.forEach((n) => {
                n.fx = null;
                n.fy = null;
            });

          // let cluster = this;

          // d.forEach((n) => {
          //   // pin cluster nodes on cluster drag end (testing out how this feels)
          //   n._fixed = true;
          //
          //   d3.selectAll('.data-node')
          //     .style('stroke', (d) => d._fixed ? "#404040" : "white");
          //
          //   d3.select(cluster)
          //     .style("stroke-dasharray", null);
          // })
        }) )
    ;

      circles.exit().remove();

      // var link_force =  d3.forceLink()
      //         .id(function(d) {
      //
      //             return d.index;
      //         })
      //         .distance(100)
      //     ;

      // self.clusterSimulation = d3.forceSimulation(clusters)
      //     .force("charge", d3.forceManyBody().strength(-100))
      //     // .force("links", link_force)
      //     .force("collisionForce", d3.forceCollide(50).strength(1))
      //     .force("center", d3.forceCenter(
      //         (this.width / 2),
      //         (this.height / 2)
      //     ))
      //     .on('tick', onClusterTick)
      // ;
      //
      //
      // var myClusters = this.clusterCircleGroup.selectAll(".clusterCircle");
      //
      // function onClusterTick() {
      //     let alpha = this.alpha();
      //     myClusters.each(moveClusterItems(alpha));
      //
      //     myClusters
      //     .attr("cx", (d) => {
      //         return d.x;
      //     })
      //         .attr("cy", (d) => {
      //             return d.y ;
      //         });
      //
      //     function moveClusterItems(alpha) {
      //
      //         debugger;
      //         return function (d) {
      //
      //             debugger;
      //             d.forEach(function (i) {
      //                 i.x += (d.x -i.x) * 0.1 * alpha;
      //                 i.y += (d.y -i.y) * 0.1 * alpha;
      //             });
      //         }
      //     }
      // }

  },

  // draw nodes
  drawNodes: function() {
    // define dragging behavior
    var self = this;
    var drag = d3.drag()
        .on('start', function(d) {
          if (!d3.event.active) {
            self.simulation.alphaTarget(0.3).restart();
          }
        })
        .on('drag', function(d) {
          self._isDragging = true;
          d3.select(this)
            .style("fill", self.clusterColor(d.cluster));
            // .style("stroke", "#404040");
          d._fixed = true;
          d.fx = d3.event.x;
          d.fy = d3.event.y;
        })
        .on('end', function(d) {
          self._isDragging = false;
          if (!d3.event.active) {
            self.simulation.alphaTarget(0);
          }
        });

    var rule = this.nodeGroup.selectAll(".data-node")
        .data(this.nodes);

    var text = this.nodeGroup.selectAll(".data-text")
        .data(this.nodes);


    rule.enter().append("circle")
      .attr("class", "rule data-node")
      .attr("transform", (d, i) => {
        return "translate(" + d.x + ", " + d.y + ")";
      })
      .attr("cluster", d => d.cluster)
      .attr("r", d => d.radius)
      .call(drag);

    // remove as needed
    rule.exit().remove();


    // also add text
    // text.enter().append('text')
    //   .attr('class', function (d) {
    //       return "rule data-text " + "text-cluster-" + d.cluster;
    //
    //   })
    //   .attr('pointer-events','none')
    //   // .attr("transform", (d, i) => {
    //   //     // debugger;
    //   //   return "translate(" + (d.x+d.radius+2) + "," + (d.y-d.radius) + ")";
    //   // })
    //     .text(function (d) {
    //         return d.name;
    //     })
    //
    // .merge(text)
    //   .text( function (d) {
    //       return d.name;
    //   })
    //   .style('font-size', 9)
    //   .style('opacity', function(d) {
    //     return 1;
    //   })
    // ;
    //
    //
    // text.exit().remove();
  },

  clusterColor: function(cluster) {
    return this.clusterColors[cluster];
  },

  drawLinks: function() {
    // var strokeScale = d3.scaleQuantile()
    //   .domain(this.links.map(d => Math.abs(d.value)))
    //   .range(d3.range(0.4, this.links.length > 200 ? 1 : 4, 0.05));

    var mainLink = this.linkGroup.selectAll('.link-1')
      .data(this.links);

    mainLink.exit().remove();
    mainLink.enter().append('path')
        .attr('class', 'link link-1')
        .attr('fill','none')
        .attr('pointer-events','none')
      // .attr(mainLink)
        .attr("value", d => d.value)
        .style("stroke-width", (d) => {
          // return strokeScale(Math.abs(d.value));
          return 0.8;
        });

    this.updateEdgeVisibility();
  },

  updateEdgeVisibility: function() {
    // link visibility
    d3.selectAll('.link-1')
      .interrupt()
      .style('stroke-opacity', (d) => {
          return 1;
        // if( !App.property.green && d.value > 0 ) {
        //   return 0;
        // }
        // else if( !App.property.red && d.value < 0) {
        //   return 0;
        // }
        // else if( Math.abs(d.value) < this.visThreshold) {
        //   return 0;
        // }
        // else {
        //   return 1;
        // }
      });

    // mouseover functionality
    d3.selectAll('.link-2')
      .interrupt()
      .attr('pointer-events', (d) => {
          return 'all';
        // if( !App.property.green && d.value > 0 ) {
        //   return 'none';
        // }
        // else if( !App.property.red && d.value < 0) {
        //   return 'none';
        // }
        // else if( Math.abs(d.value) < this.visThreshold) {
        //   return 'none';
        // }
        // else {
        //   return 'all';
        // }
      });
  },

  // the big workhorse of the simulation ???
  createForceLayout: function() {
    var nodeArr = this.nodes;

    // var radiusScale = d3.scaleLinear()
    //   .domain(d3.extent(Object.keys(data), (d) => {
    //     return data[d].hits;
    //   }))
    //   .range([4, 14]);

    var borderNodeMargin = 10;

    var self = this;



    var node = this.nodeGroup.selectAll(".data-node")
            .style("fill", function(d) {
                return self.clusterColor(d.cluster);

            })
        ;
    var link = this.linkGroup.selectAll(".link");
    // var text = this.nodeGroup.selectAll(".data-text");

    var cluster = this.clusterCircleGroup.selectAll(".clusterCircle");
      var clampX = d3.scaleLinear()
          .domain([3 + borderNodeMargin, self.width - 3 - borderNodeMargin])
          .range([3 + borderNodeMargin, self.width - 3 - borderNodeMargin])
          .clamp(true);

      var clampY = d3.scaleLinear()
          .domain([3 + borderNodeMargin, self.height - 3 - borderNodeMargin])
          .range([3 + borderNodeMargin, self.height - 3 - borderNodeMargin])
          .clamp(true);

      node.exit().remove();

      var circlePadding = self.getNodeRadius() + 2;

      function tick() {
        // function moveCluster(alpha) {
        //     nodeArr.forEach(function (d) {
        //
        //     });
        // }
        // node.each(moveCluster(this.alpha()));

        node.attr("transform", (d,i,el) => {
          if (!d){
              return;
          }
                d.x = clampX(d.x);
                d.y = clampY(d.y);

            return "translate(" + d.x + "," + d.y + ")";
          });

      link
        .style("stroke", (d) => {
            if (!d){
                return;
            }

            var dx = d.target.x - d.source.x,
              dy = d.target.y - d.source.y;

            // if (!dx || !dy) {
            //     return;
            // }

            var type = d.type;

            if (Math.abs(dy/dx) > 3) {
                return dy < 0 ? "url(#" + type + "Up)" : "url(#" + type + "Down)";
            }
            return dx < 0 ? "url(#" + type + "Left)" : "url(#" + type + "Right)";

        })
        .attr('d', createArrowPath);

      self.clusterCircleGroup.selectAll(".clusterCircle")
        .attr("cx", (d) => {
            if (!d){
                return;
            }

            var ext = d3.extent(d, node => node.x);
          //
          // return Math.max(25, Math.min(self.width-25, (ext[1] + ext[0]) / 2));

          return d.x = (ext[1] + ext[0]) / 2;
        })
        .attr("cy", (d) => {
            if (!d){
                return;
            }

            var ext = d3.extent(d, node => node.y);
          // if (isNaN(ext[0])  || isNaN(ext[1])) {
          //   // console.log(d);
          // }
          //
          //   return Math.max(25, Math.min(self.height-25, (ext[1] + ext[0]) / 2));

             return d.y = (ext[1] + ext[0]) / 2;
        })
        .attr("r", function(d) {
            if( !d) {
                return;
            }
           // return d.radius;
          var x = Number(d3.select(this).attr("cx"));
          var y = Number(d3.select(this).attr("cy"));

          var radius = d3.max(d, (node) => {
            return Math.sqrt(Math.pow((node.x - x), 2) + Math.pow((node.y - y), 2));
            //  + radiusScale(node.hits);
          });

          if (isNaN(radius)) {
            // console.log(d);
          }

          return d.r = (radius + circlePadding);
        });


       // recompute centroids
        let totalClusters = self.clusterCount;
        for(var i =0; i< totalClusters; i++) {
            self.clusterCentroids[i] = self.computeCentroid(i);
        }

        // shift text with respect to new centroids
        // text.attr("transform", (d) => {
        //     if (!d) {
        //         return;
        //     }
        //     let centroid =  self.clusterCentroids[d.cluster];
        //     let dx = d.x - centroid.x;
        //     let dy = d.y - centroid.y;
        //     if (!dx || !dy) {
        //         return;
        //     }
        //     let distance = Math.sqrt(dx*dx + dy*dy);
        //     let kx = dx / distance;
        //     let ky = dy / distance;
        //     let shiftX = kx * (d.radius + 15);
        //     let shiftY = ky * (d.radius + 15);
        //     return "translate(" + (d.x + shiftX) + "," + (d.y + shiftY) + ")";
        // });


        if (!!self.ontickCallback) {
          self.ontickCallback();
      }
    }

    function createArrowPath(d) {

        if (!d) {
            return;
        }
        var target = isNumeric(d.target) ? nodeArr[d.target] : d.target,
          source = isNumeric(d.source) ? nodeArr[d.source] : d.source;

        if (target == source) {
            return;
        }
      var dx = target.x - source.x,
          dy = target.y - source.y,
          dr = Math.sqrt(dx * dx + dy * dy)*2;

      if (dr == 0) {
          return "";
      }

      var nx = -dx / dr,
          ny = -dy / dr;

      if (dr < 100) { dr /= 2; }

      var t = {
        x: target.x + (target.radius+3)*nx,
        y: target.y + (target.radius+3)*ny
      };

      if (this.classList.contains('link-1')) {
        return  "M" + source.x + "," + source.y +
                "A" + dr + "," + dr + " 0 0,1 " +
                t.x + "," + t.y;
      }
      else {
        nx *= 8, ny *= 8;
        t.x += nx, t.y += ny;

        return  "M" + source.x + "," + source.y +
              "A" + dr + "," + dr + " 0 0,1 " +
              t.x + "," + t.y+
              "m" + (2*nx-ny) + ',' + (2*ny+nx) +
              "L" + t.x + "," + t.y+
              "l" + (2*nx+ny) + ',' + (2*ny-nx);
      }
    }


      var link_force =  d3.forceLink(self.links)
              .id(function(d) {

                  return d.index;
              })
              .distance((d) => {
                  return self.getLinkDistance();
              })
          // .strength(1)
          ;

    self.simulation
        .force("links", link_force)
        .force("collision", d3.forceCollide(self.getNodeRadius() + 3))
        .force("cluster", clustering)
        .on("tick", tick)
    ;


    // Initial clustering forces:
    function clustering(alpha) {

      var clusterNodes = {};
      let myCluster;
      let firstNode;
      for(let i=0; i< self.clusters.length; i++) {
          myCluster = self.clusters[i];
          if (myCluster.length < 1) {
              continue;
          }

          firstNode = myCluster[0];

          clusterNodes[firstNode.cluster] = firstNode;
      }

      nodeArr.forEach(function(d) {
        var cluster = clusterNodes[d.cluster];
        if (cluster === d) return;
        var x = d.x - cluster.x,
            y = d.y - cluster.y,
            l = Math.sqrt(x * x + y * y),
            r = d.radius + cluster.radius + 10;
        if (x === 0 && y === 0 || isNaN(l)|| isNaN(r) || (isNaN(x) || isNaN(y))) return;
        if (l !== r) {
          l = (l - r) / l * alpha ;
          d.x -= x *= l;
          d.y -= y *= l;
          cluster.x += x;
          cluster.y += y;
        }
      });
    }

    function collide(alpha) {
      var padding = 30;
      var clusterPadding = 50; // separation between different-color circles
      var repulsion = 3;
      var maxRadius = 100;
      var quadtree = d3.quadtree()
          .x((d) => d.x)
          .y((d) => d.y)
          .addAll(nodeArr);

      nodeArr.forEach(function(d) {
        // if (d.cluster === 0 || (d.isPainted && d.paintedCluster === undefined)) { return; }
        var r = d.radius + maxRadius + Math.max(padding, clusterPadding),
            nx1 = d.x - r,
            nx2 = d.x + r,
            ny1 = d.y - r,
            ny2 = d.y + r;
        quadtree.visit(function(quad, x1, y1, x2, y2) {
          if (quad.data && (quad.data !== d)) {

            var link = self.links.find(link => link.target == quad.data && link.source == d);
            if (!link) { return;}

            var x = d.x - quad.data.x,
                y = d.y - quad.data.y,
                l = Math.sqrt(x * x + y * y),
                r = d.radius + quad.data.radius;

            if (d.cluster === quad.data.cluster) {
              r += (link.value < 0) ? padding*repulsion : padding;
            }
            else {
              r += clusterPadding;
            }

            if (l < r && l > 0) {
              l = (l - r) / l * alpha;
              d.x -= x *= l;
              d.y -= y *= l;
              quad.data.x += x;
              quad.data.y += y;
            }
          }
          return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
        });
      });
    }
  }, // end createForceLayout

  // to be called externally: change the source data

};
