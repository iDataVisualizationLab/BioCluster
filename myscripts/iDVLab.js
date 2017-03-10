/**
 * Created by vinhtngu on 2/24/17.
 * G: is the adjancency list
 * s,source = node
 * adjmatrix: adjacency matrix
 * community: dictionary of community where keys are nodes and values are communities
 */


/**
 * @param G: adjacency list
 * @param source: node
 * @returns {Object}: distance from source to other nodes
 */
function single_source_shortest_path_length(G, source) {
    var seen = new Object();
    var level = 0;
    var nextlevel = new Object();
    nextlevel[source] = 1;
    while (Object.keys(nextlevel).length > 0) {
        var thislevel = nextlevel
        nextlevel = {};
        for (var v in thislevel) {
            if (!seen.hasOwnProperty(v)) {
                seen[v] = level;
                for (var w = 0; w < G[v].length; w++) {
                    nextlevel[G[v][w]] = {};
                }
            }
        }
        level += 1;
    }
    return seen;

}
function single_source_shortest_path(G, source) {
    var level = 0;
    var nextlevel = new Object();
    nextlevel[source] = 1;
    var paths = new Object();
    paths[source] = [source];
    while (Object.keys(nextlevel).length > 0) {
        var thislevel = nextlevel
        nextlevel = {};
        for (var v in thislevel) {
            for (var w = 0; w < G[v].length; w++) {
                if (!paths.hasOwnProperty(G[v][w])) {
                    paths[G[v][w]] = [];
                    for (i = 0; i < Object.keys(paths[v]).length; i++) {
                        paths[G[v][w]].push(paths[v][i]);
                    }
                    paths[G[v][w]].push(G[v][w]);
                    nextlevel[G[v][w]] = 1;

                }
            }
        }
        level += 1;
    }
    return paths;
}
function eccentricity(G) {
    var e = new Object();
    for (n = 0; n < G.length; n++) {
        var lenght = single_source_shortest_path_length(G, n);
        var max = d3.max(Object.values(lenght), function (d) {
            return d;
        })
        e[n] = max;
    }
    return e;
}
function diameter(G) {
    var diameter = d3.max(Object.values(eccentricity(G)), function (d) {
        return d;
    });
    return diameter;
}
function all_pairs_shortest_path_length(G) {
    var paths = new Object();
    for (n = 0; n < G.length; n++) {
        paths[n] = single_source_shortest_path_length(G, n)
    }
    return paths
}
function all_pairs_shortest_path(G) {
    var paths = new Object();
    for (n = 0; n < G.length; n++) {
        paths[n] = single_source_shortest_path(G, n)
    }
    return paths
}
function predecessor(G, source) {
    var level = 0;
    var nextlevel = [source];
    var seen = new Object();
    seen[source] = level;
    var pred = new Object();
    pred[source] = [];
    while (Object.keys(nextlevel).length > 0) {
        level = level + 1
        var thislevel = nextlevel;
        nextlevel = [];
        for (var v = 0; v < thislevel.length; v++) {
            for (var w = 0; w < G[thislevel[v]].length; w++) {
                if (!seen.hasOwnProperty(G[thislevel[v]][w])) {
                    pred[G[thislevel[v]][w]] = [];
                    pred[G[thislevel[v]][w]].push(thislevel[v]);
                    seen[G[thislevel[v]][w]] = level;
                    nextlevel.push(G[thislevel[v]][w])
                } else if (seen[G[thislevel[v]][w]] === level) {
                    pred[G[thislevel[v]][w]].push(thislevel[v]);
                }
            }
        }
    }
    return pred;

}
function all_shortest_paths(G, source, target) {

}
function _single_source_shortest_path_basic(G, s) {
    var S = [], P = new Object(), sigma = new Object(), D = new Object();
    for (var item = 0; item < G.length; item++) {
        P[item] = [];
        sigma[item] = 0;
    }
    sigma[s] = 1;
    D[s] = 0;
    var Q = [];
    Q.push(s);
    while (Q.length > 0) {
        v = Q.shift();
        S.push(v);
        Dv = D[v];
        sigmav = sigma[v];
        for (var item = 0; item < G[v].length; item++) {
            if (!D.hasOwnProperty(G[v][item])) {
                Q.push(G[v][item]);
                D[G[v][item]] = Dv + 1;
            }
            if (D[G[v][item]] === Dv + 1) {
                sigma[G[v][item]] += sigmav;
                P[G[v][item]].push(v);
            }
        }

    }
    return [S, P, sigma];
}
function _accumulate_edges(betweenness, S, P, sigma, s) {
    var delta = new Object();
    for (var i = 0; i < S.length; i++) {
        delta[S[i]] = 0;
    }
    while (S.length > 0) {
        var w = S.pop();
        var coeff = (1.0 + delta[w]) / sigma[w];
        for (var v = 0; v < P[w].length; v++) {
            var c = sigma[P[w][v]] * coeff;
            var p1 = P[w][v] + "," + w;
            var p2 = w + "," + P[w][v];
            if (!betweenness.hasOwnProperty(p1)) {
                betweenness[(p2)] += c;
            } else {
                betweenness[(p1)] += c;
            }
            delta[P[w][v]] += c;
        }
        if (w !== P[w][v]) {
            betweenness[w] += delta[w];
        }
    }
    return betweenness;
}
function betweenness_centrality(G) {
    var betweenness = new Object();
    for (var i = 0; i < G.length; i++) {
        betweenness[i] = 0;
    }
    for (var s = 0; s < G.length; s++) {
        var results = _single_source_shortest_path_basic(G, s);
        var S = results[0], P = results[1], sigma = results[2];
        betweenness = _accumulate_basic(betweenness, S, P, sigma, s);
    }
    betweenness = _rescale(betweenness, G.length);
    return betweenness;
}
function _rescale(betweenness, n) {
    var scale = 2.0 / ((n - 1) * (n - 2));
    for (var v in betweenness) {
        betweenness[v] *= scale;
    }
    return betweenness;
}
function _accumulate_basic(betweenness, S, P, sigma, s) {
    var delta = new Object();
    for (var i = 0; i < Object.keys(betweenness).length; i++) {
        delta[i] = 0.0
    }
    while (S.length > 0) {
        var w = S.pop();
        var coeff = (1.0 + delta[w]) / sigma[w];
        for (var v = 0; v < P[w].length; v++) {
            delta[P[w][v]] += sigma[P[w][v]] * coeff;
        }
        if (w !== s) {
            betweenness[w] += delta[w];
        }

    }

    return betweenness
}
function average_node_degree(G) {
    return d3.mean(G, function (d) {
        return d.length;
    });

}
function average_shortest_path_length(G){
    var avg=0.0;
    for(var n=0;n<G.length;n++){
        var path_length = single_source_shortest_path_length(G,n);
        avg += d3.sum(Object.values (path_length), function (d) {
            return d;
        })
    }
    var n = G.length;
    return avg/(n*(n-1));

}
function _accumulate_edges(betweenness, S, P, sigma, s) {
    var delta = new Object();
    for (var i = 0; i < S.length; i++) {
        delta[S[i]] = 0;
    }
    while (S.length > 0) {
        var w = S.pop();
        var coeff = (1.0 + delta[w]) / sigma[w];
        for (var v = 0; v < P[w].length; v++) {
            var c = sigma[P[w][v]] * coeff;
            var p1 = P[w][v] + "," + w;
            var p2 = w + "," + P[w][v];
            if (!betweenness.hasOwnProperty(p1)) {
                betweenness[(p2)] += c;
            } else {
                betweenness[(p1)] += c;
            }
            delta[P[w][v]] += c;
        }
        if (w !== P[w][v]) {
            betweenness[w] += delta[w];
        }
    }
    return betweenness;
}

function edge_betweenness_centrality(G) {
    var edge_betweenness = new Object();
    for (var r = 0; r < G.length; r++) {
        for (var c = 0; c < G[r].length; c++) {
            var p1 = r + ',' + G[r][c];
            var p2 = G[r][c] + ',' + r;
            if (edge_betweenness.hasOwnProperty(p2)) {
                continue;
            } else {
                edge_betweenness[(p1)] =0;
            }
        }
    }
    for (var s = 0; s < G.length; s++) {
        var results = _single_source_shortest_path_basic(G, s);
        var S = results[0], P = results[1], sigma = results[2];
        edge_betweenness = _accumulate_edges(edge_betweenness, S, P, sigma, s);
    }
    for (n = 0; n < G.length; n++) {
        delete edge_betweenness[n];
    }
    edge_betweenness = _rescale_e(edge_betweenness, G.length);
    return edge_betweenness;
}
function _rescale_e(edge_betweenness, n) {
    var scale = 1.0 / (n * (n - 1));
    for (var v in edge_betweenness) {
        edge_betweenness[v] *= scale;
    }
    return edge_betweenness;
}

/**Modularity function created on March 9, 2017 by vinhtngu
 * @param partition: community array where index is the community and array values are nodes
 * @param adjmatrix: adjacency matrix
 * @returns {number}: Q modularity values
 */
function modularity(partition, adjmatrix) {
    var Q_modularity=0;
    var numNode = adjmatrix.length;
    var num2xlinks =0;
    adjmatrix.forEach(function (d) {
        num2xlinks+= d3.sum(d, function (e) {
            return e;
        })
    });
    partition.forEach(function (d,i) {
        var in2xlinks =0;
        var indegre=0;
        d.forEach(function (a) {
            d.forEach(function (b) {
                if(b!==a){
                    in2xlinks+= adjmatrix[a][b];
                }
            })
            indegre+= d3.sum(adjmatrix[a],function (f) {
                return f;
            })
        })
        var inlink = in2xlinks/2;
        Q_modularity += inlink*2/num2xlinks - Math.pow(indegre/num2xlinks,2);
    });
    return Q_modularity;
}