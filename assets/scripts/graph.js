// start view var for element views
let startView;
// element view for final 
let endView;
// sets the mode of either editing or not
var editMode = 'edit';
// this is the path that is displayed
let pathMembersViews = [];
// for placing elements
let current_index = 0;
// id for showing the path
let nextId = 0;
// display variables
const pathMemberHighlightId = 'path-member';
const invalidPathHighlightId = 'invalid-path-member';
const pathMemberClassName = 'path-member';
const invalidPathClassName = 'invalid-path';
const highlightId = 'start-highlight';
const blueColor = '#54ccff';
const blackColor = '#222222';
const invalidColor = '#FF4365';
const outlineColor = '#616161';
// links between nodes
const links = {}
// size of nodes
const size = 40;
// starting views for the start and end nodes
const getStartView = () => startView;
const getEndView = () => endView;
// initializing joint graph
const graph = new joint.dia.Graph;
// making the element for the HTML
const paperElement = document.getElementById('interactive-graph');
// map array for adj array
var map_array = []
// initializing graph
var namespace = joint.shapes;

// toggling between edit and view mode
document.addEventListener("toggleMode", (event) => {
    // triggered by event passed from the html
    let mode = event.detail.mode;
    editMode = mode;
    // toggles type of mode with the view
    toggleView(editMode);
});

// clearing the map from event triggered by html
document.addEventListener("clearMap", (event) => {
    clearMap();
});

// styling for graph elements
const startAttrs = {
    padding: 2,
    attrs: {
        stroke: blueColor,
        'stroke-width': 2
    }
};

// more styling for links
const getTargetMarkerStyle = () => ({
    type: 'path',
    d: null,
    fill: blackColor,
    stroke: blackColor,
    tools: {
        linkTools: []
    }
});

// this is if the links are highlighted when displaying path
const getLinkStyle = () => {
    return V.createSVGStyle(`
    .joint-link .${pathMemberClassName} {
        stroke: #54ccff;
    }
`);
}

// this initializes the joint graph
const paper = new joint.dia.Paper({
    el: paperElement,
    width: 800,
    height: 650,
    gridSize: 1,
    model: graph,
    sorting: joint.dia.Paper.sorting.APPROX,
    defaultLink: () => new joint.shapes.standard.Link({
        attrs: {
            line: {
                targetMarker: getTargetMarkerStyle(),
                stroke: outlineColor
            }
        },
    }),
    defaultConnectionPoint: { name: 'boundary', args: { offset: 4 } },
    linkPinning: false,
    async: true,
    frozen: false,
    // allows for toggling of edit vs view modes
    interactive: () => {
        return editMode === "edit";
    },
    validateConnection: (cellViewS, _magnetS, cellViewT) => {
        const id = [cellViewS.model.id, cellViewT.model.id].sort().join();
        const existingLink = graph.getCell(id);
        const isSameCell = cellViewS.model.id === cellViewT.model.id;

        return !isSameCell && !existingLink && !cellViewT.model.isLink();
    },
    highlighting: {
        connecting: {
            name: 'mask',
            options: {
                padding: 2,
                attrs: {
                    stroke: blueColor,
                    'stroke-width': 2
                }
            }
        }
    }
});

// controller for graph to switch views
class Controller extends joint.mvc.Listener {
    get context() {
        const [ctx = null] = this.callbackArguments;
        return ctx;
    }
}

// this is the view controller which only allows certain inputs from the user
class ViewController extends Controller {
    startListening() {
        const { paper } = this.context;
        // these are the allowed inputs from the user (clicking, hovering)
        this.listenTo(paper, {
            'element:pointerdown': selectSource,
            'element:mouseenter': selectEnd,
            'element:mouseleave': hidePathOnMouseLeave,
        });
    }
}
// selecting the source node for display
function selectSource({ setStartView }, elementView) {
    setStartView(elementView);
}

// selecting the end view for the display of the path
function selectEnd({ showPath, setEndView, getStartView, getEndView }, elementView) {
    const pathStartView = getStartView();
    const pathEndView = getEndView();

    // highlighting the path
    if (elementView === pathStartView) return;
    if (pathStartView && pathEndView) {
        joint.highlighters.addClass.remove(pathStartView, invalidPathHighlightId);
        joint.highlighters.addClass.remove(pathEndView, invalidPathHighlightId);
    }
    setEndView(elementView);
    // showing the path
    showPath();
}

// hiding the path when the mouse leaves to node
function hidePathOnMouseLeave({ hidePath, getStartView, getEndView, setEndView }) {
    const pathStartView = getStartView();
    const pathEndView = getEndView();

    // hiding the path
    hidePath();
    // removing the highlighted elements
    if (pathStartView) joint.highlighters.addClass.remove(pathStartView, invalidPathHighlightId);
    if (pathEndView) joint.highlighters.addClass.remove(pathEndView, invalidPathHighlightId);
    setEndView(null);
}

// this is what inputs are allowed for editing
class EditController extends Controller {
    startListening() {
        const { graph, paper } = this.context;
        // we have a way to add links here
        this.listenTo(graph, {
            'change:source': replaceLink,
            'change:target': replaceLink,
        });
        // here is how to add and remove nodes
        this.listenTo(paper, {
            'element:mouseenter': showElementTools,
            'element:mouseleave': hideElementTools,
            'element:pointerdblclick': removeElement,
            'blank:pointerdblclick': addElement
        });
    }
}
// this shows elements tools, we don't use this because we don't remove links
function showElementTools(_context, elementView, _evt) {
    elementView.showTools();
}
// this is the same as above but to high the tools, we don't use this
function hideElementTools(_context, elementView) {
    elementView.hideTools();
}

// this is used to replace links, so that if a node is deleted with links, the links are deleted
function replaceLink({ createLink }, link, _collection, opt) {
    // identifies source and target
    const sourceId = link.get('source').id;
    const targetId = link.get('target').id;
    // this removes a link
    if (opt.ui && sourceId && targetId) {
        createLink(sourceId, targetId);
        link.remove();
    }
}

// this is used to remove nodes
function removeElement({ setStartView, setEndView, getStartView }, elementView) {
    const pathStart = getStartView();

    // setting the start and end views as null just to remove the teh possibility of that node being selected as a start or end node
    if (pathStart && pathStart.model) {
        if (elementView.model.id === pathStart.model.id) {
            setStartView(null);
            setEndView(null);
        }
    } else {
        // checking is this is a valid path
        console.warn("pathStart is undefined or does not have a model");
    }
    // if the element is there
    if (elementView && elementView.model) {
        const modelId = elementView.model.id;

        // editing the map array for saving the map
        if (Array.isArray(map_array)) {
            // get the point index
            const pointIndexInMap = map_array.findIndex(point => point.id === modelId);
            if (pointIndexInMap !== -1) {
                // set the map coords as n/a because the node doesn't exist
                // we don't delete because that messes up the indexing for the loading of the map
                map_array[pointIndexInMap].x = "n/a";
                map_array[pointIndexInMap].y = "n/a";

                // this goes through each node, making sure they exist
                map_array.forEach(node => {
                    if (node.end && Array.isArray(node.end)) {
                        const endIndex = node.end.indexOf(modelId);
                        if (endIndex !== -1) {
                            // if they don't exist, remove them
                            node.end.splice(endIndex, 1);
                        }
                    }
                });
                // this removes nodes from the adjacency list, for path-finding calculations
                if (Array.isArray(adj_array)) {
                    // finds node and removes it
                    adj_array = adj_array.filter(edge => edge[0] !== modelId && edge[1] !== modelId);
                } else {
                    console.error("adj_array is undefined or not an array");
                }
            } else {
                console.warn("Point not found in map_array");
            }
        } else {
            console.error("map_array is undefined or not an array");
        }

        elementView.model.remove();
    } else {
        console.warn("Cannot remove element: elementView or elementView.model is undefined");
    }
}

// adding an element to the map
function addElement({ createNode, size }, _evt, x, y) {
    // this defines what a node is
    const node = createNode(getNodeId(), x - size / 2, y - size / 2);
    // gives the node it's position
    node.position(x - size / 2, y - size / 2);
    // add it to the node array
    nodes_array.push(node);
    // add it to the map array so that we can save the map
    map_array.push({
        id: node.id,
        x: node.attributes.position.x,
        y: node.attributes.position.y
    });

}

// this is for changing the position of the node
graph.on('change:position', function (cell) {
    if (cell.isElement()) {
        // this gets the node id
        const nodeId = cell.id;
        const center = cell.getBBox().center();
        // gets node coordinates
        node_coords[nodeId] = center;
        // fins the node in the map
        const nodeInMap = map_array.find(node => node.id === nodeId);
        if (nodeInMap) {
            // change the coords to the new ones when it is moved
            nodeInMap.x = center.x;
            nodeInMap.y = center.y;
        }
        // finds the node in the adj array
        adj_array.forEach(connection => {
            // gets the link
            const [sId, tId, oldDistance] = connection;
            if (sId === nodeId || tId === nodeId) {
                // gets the source and target
                const source = getNodefromId(sId);
                const target = getNodefromId(tId);
                // if the source and target exist
                if (source && target) {
                    // update the x, y coords
                    const newX1 = source.attributes.position.x;
                    const newX2 = target.attributes.position.x;
                    const newY1 = source.attributes.position.y;
                    const newY2 = target.attributes.position.y;
                    // calculate a new distance
                    const newDistance = Math.sqrt((newX1 - newX2) ** 2 + (newY1 - newY2) ** 2) * (20 / Math.sqrt(400 ** 2 + 800 ** 2));
                    // te the new connection
                    connection[2] = newDistance;
                }
            }
        });

    }
});

// these are the controllers for the viewing vs th editing
// these contain the functions necessary to run the program properly
const viewController = new ViewController({ paper, showPath, hidePath, setStartView, setEndView, getStartView, getEndView });
const editController = new EditController({ graph, paper, createLink, createNode, setStartView, setEndView, getStartView, size });

// for the edit controller, we need to start the listener to edit
editController.startListening();
// getting the current id
function getCurrentID() {
    return current_index;
}
// getting the node id
function getNodeId() {
    current_index++;
    return current_index;
}
// getting the node from an id
function getNodefromId(id) {
    // this is used to find nodes we need in some cases
    for (let i = 0; i < nodes_array.length; i++) {
        if (nodes_array[i].id == id) {
            return nodes_array[i];
        }
    }
}

// this creates a new node
function createNode(id) {
    // we define what a node is
    var node = new joint.shapes.standard.Circle({
        id,
        size: { width: 40, height: 40 },
        attrs: {
            body: {
                fill: 'black'
            },
            label: {
                fill: 'white'
            }
        }
    }).addTo(graph);
    // we add it to the graph
    var view = node.findView(paper);
    // we add the tools view for it, such as the little icon to show the connection
    view.addTools(new joint.dia.ToolsView({
        tools: [
            new joint.elementTools.HoverConnect({
                useModelGeometery: true,
                trackPath: V.convertCircleToPathData(joint.V(`<circle cx="${40 / 2}" cy="${40 / 2}" r="${40 / 2}" />`))
            }),
        ]
    }))
    // hide the tools when not using the node
    view.hideTools();
    // label with the id
    node.attr('label/text', id);
    return node;
}

// creating a link
function createLink(s, t) {
    // makes sure that the nodes that the link is connected to actually exist
    if (!getNodefromId(s) || !getNodefromId(s).attributes || !getNodefromId(t) || !getNodefromId(t).attributes) {
        console.warn(`Cannot create link. Source or target node is invalid or missing attributes. Source: ${s}, Target: ${t}`);
        return;
    }
    // this gets the positions of the nodes
    let x1 = getNodefromId(s).attributes.position.x;
    let x2 = getNodefromId(t).attributes.position.x;
    let y1 = getNodefromId(s).attributes.position.y;
    let y2 = getNodefromId(t).attributes.position.y;

    // if the coordinates are n/a, we skip the link
    // this is only used when regenerating the graph
    if (x1 === "n/a" || y1 === "n/a" || x2 === "n/a" || y2 === "n/a") {
        console.warn(`Cannot create link. One or more coordinates are invalid (n/a). Source: ${s}, Target: ${t}`);
        return;
    }
    // we get the link id from the source and target
    var linkId = [s, t].sort().join();
    // define what a link is
    var link = new joint.shapes.standard.Link({
        id: linkId,
        source: { id: s },
        target: { id: t },
        z: 1,
        distance: Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2) * (20 / Math.sqrt(400 ** 2 + 800 ** 2)),
        attrs: {
            label: {
                pointerEvents: 'auto'
            },
            body: {
                pointerEvents: 'none'
            },
            wrapper: {
                stroke: 'white',
                'stroke-width': 6
            },
            line: { targetMarker: getTargetMarkerStyle(), stroke: outlineColor }
        },
    });
    // add the link to the links array
    links[linkId] = link;
    // this is how we get the data we need for the adjacency list
    if (link.attributes.target.hasOwnProperty("id")) {
        const sId = link.attributes.source.id;
        const tId = link.attributes.target.id;
        const distance = link.attributes.distance;
        // we get the link connection id
        const maxId = Math.max(sId, tId);
        // we create an array full of infinite values
        while (adj_List.length < maxId) {
            adj_List.push(Array(maxId).fill(10000));
        }
        // we push the source, target, and distance
        adj_array.push([sId, tId, distance]);
        // this is the source and target nodes for connections
        const sourceNode = map_array.find(node => node.id === sId);
        const targetNode = map_array.find(node => node.id === tId);
        // this is used for the source and target nodes for creating the link
        if (sourceNode) {
            if (!Array.isArray(sourceNode.end)) {
                sourceNode.end = [];
            }
            if (!sourceNode.end.includes(tId)) {
                sourceNode.end.push(tId);
            }
        } else {
            console.warn(`Node ${sId} not found in map_array`);
        }

    }
    // create the link
    link.addTo(graph);

    var view = link.findView(paper);
    view.addTools(new joint.dia.ToolsView({
        tools: []
    }));
    // add the link to the edge array
    edge_array.push(link);
    view.hideTools();
}

// setting the start view
function setStartView(elementView) {
    // hide the path
    hidePath();
    // remove the highlights
    if (startView) {
        joint.highlighters.mask.remove(startView, highlightId);
        joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
    }
    // remove the invalid path
    if (endView) {
        joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
    }
    // highlight the path by changing the color of each element
    if (elementView) {
        joint.highlighters.mask.add(elementView, 'body', highlightId, startAttrs);
    }
    // setting the start view
    startView = elementView;
    start.length = 0
    start.push(elementView.model.id)
}

// setting the ending view
function setEndView(elementView) {
    // this sets the end node
    endView = elementView
    end.length = 0
    end.push(elementView.model.id)
}

// this gets the path of the element
function getElementPath() {
    // we get the adj list
    adj_List = Array.from({ length: current_index }, () => Array(current_index).fill(10000));

    // for each element in the list
    for (let i = 0; i < adj_array.length; i++) {
        // we get the path from one node to another
        const [fromNode, toNode, weight] = adj_array[i];
        // checking for invalid edges
        if (fromNode < 0 || fromNode >= current_index + 1 || toNode < 0 || toNode >= current_index + 1) {
            console.error(`Invalid edge in adj_array: ${adj_array[i]}. Current index: ${current_index}`);
            continue;
        }
        // we look through the adj list and place the weights, this works for bidirectional graphs
        adj_List[fromNode - 1][toNode - 1] = weight;
        adj_List[toNode - 1][fromNode - 1] = weight;
    }
    // getting the adj list and setting the path from one node to itself to 0
    for (let i = 0; i < current_index; i++) {
        adj_List[i][i] = 0;
    }

    // this is the payload to the backend server
    const payload = {
        adjacencyList: adj_List,
        source: parseInt(start),
        target: parseInt(end)
    };
    
    console.log("Payload sent to backend: ", payload)
    // this is the backend URL
    const backendURL = 'http://127.0.0.1:8199/api/dijkstra';
    // opens a request to the backend
    const xhr = new XMLHttpRequest();
    // this is a post to the backend
    xhr.open('POST', backendURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    // works on the basis of a promise, using async functions to make sure that everything is executed in the proper time
    return new Promise((resolve, reject) => {
        xhr.onload = function () {
            // if we receive a 200 error
            if (xhr.status >= 200 && xhr.status < 300) {
                // get the response from the server, which is the path in this case
                const response = JSON.parse(xhr.responseText);
                console.log("Response recieved from server", response)
                // resolve the promise, continue with plotting the pathway
                resolve(response)
            } else {
                console.error('Request failed with status:', xhr.status);
            }
        };

        xhr.onerror = function () {
            console.error('Request failed');
        };
        // sending the json
        xhr.send(JSON.stringify(payload));
    });
}
// this is for saving a map
function saveMap(map_Name) {
    // this is the payload for the backend
    const payload = {
        map: map_array,
        mapName: map_Name
    };  
        
    console.log("Saving Map: ", payload)

    const backendURL = 'http://127.0.0.1:8199/api/map';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', backendURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    // again use promises for timing
    return new Promise((resolve, reject) => {
        xhr.onload = function () {

            if (xhr.status >= 200 && xhr.status < 300) {
                const response = JSON.parse(xhr.responseText);
                // loads the maps again to make sure they are all shown in the list
                loadMaps()
                console.log("Response from server for saving: ", response)
                // resolving the promise with a response that shows if the map was saved properly
                resolve(response)
            } else {
                console.error('Request failed with status:', xhr.status);
            }
        };

        xhr.onerror = function () {
            console.error('Request failed');
        };

        xhr.send(JSON.stringify(payload));
    });
}
// this gets all maps from the backend
function getMaps() {
    const backendURL = 'http://127.0.0.1:8199/api/getMaps';

    const xhr = new XMLHttpRequest();
    xhr.open('GET', backendURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    return new Promise((resolve, reject) => {
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                const response = JSON.parse(xhr.responseText);
                console.log("response recieved from server for loading maps: ", response)
                // this resolve contains a structure of all the maps compiled into one
                resolve(response);
            } else {
                console.error('Request failed with status:', xhr.status);
                reject(new Error(`Request failed with status ${xhr.status}`));
            }
        };

        xhr.onerror = function () {
            console.error('Request failed');
            reject(new Error('Request failed'));
        };

        xhr.send();
    });
}


// this gets the link path
function getLinkPath(elementPath) {
    // this defines the link path to highlight the correct edges and nodes
    const linkPath = [];

    // if there is a start view
    if (startView) {
        // iterate through each element in the path (node-edge-node)
        for (let i = 0; i < elementPath.length - 1; i++) {
            const sourceId = elementPath[i];
            const targetId = elementPath[i + 1];
            const link = graph.getCell([sourceId, targetId].sort().join());
            if (!link) continue;
            // this pushes the path of the links to an array
            linkPath.push(link.id);
        }
    }
    // return the link path for processing
    return linkPath;
}

// showing the path of the algorithm, using async to wait for the data to come from the backend
async function showPath() {
    // this gets the element path
    const elementPath = await getElementPath();
    // checks if the path is found
    const isPathFound = elementPath.length > 0;
    // if the path is not found
    if (!isPathFound && startView && endView && startView.id !== endView.id && !editMode) {
        // highlight the elements as red for the path to show that it is not found
        joint.highlighters.addClass.add(startView, 'body', invalidPathHighlightId, {
            className: invalidPathClassName
        });
        joint.highlighters.addClass.add(endView, 'body', invalidPathHighlightId, {
            className: invalidPathClassName
        });
        hidePath();
        return;
    }
    // removes styling when not needed
    if (startView) joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
    if (endView) joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
    // hides the path from view
    hidePath();
    // gets the link path
    const linkPath = getLinkPath(elementPath);

    // for each element in the path
    for (const elementId of [...elementPath, ...linkPath]) {
        const element = graph.getCell(elementId);
        const view = element.findView(paper);
        const isLink = view.model.isLink();
        // show the path on screen
        joint.highlighters.addClass.add(view, isLink ? 'line' : 'body', pathMemberHighlightId, {
            className: pathMemberClassName
        });

        if (isLink) {
            element.set('z', 2);
        }
        // push the view to show
        pathMembersViews.push(view);
    }
}

// hide the path from the viewer
function hidePath() {
    for (const view of pathMembersViews) {
        const model = view.model;
        // remove the styling from view
        joint.highlighters.addClass.remove(view, pathMemberHighlightId);

        if (model.isLink()) {
            model.set('z', 1);
            model.labels([]);
        }
    }
    // remove the path members from the array
    pathMembersViews = [];
}

// change the link style
function toggleLinkStyle() {
    if (linkStyle) paper.svg.removeChild(linkStyle);
    // get the link style
    linkStyle = getLinkStyle();
    // change the style
    paper.svg.prepend(linkStyle);
}

// define the styles of a element (node) when it is highlighted as invalid or valid
const styles = V.createSVGStyle(`
    .joint-element .${pathMemberClassName} {
        stroke: ${blueColor};
        fill: ${blueColor};
        fill-opacity: 0.75;
    }
    .joint-element .${invalidPathClassName} {
        stroke: ${invalidColor};
        fill: ${invalidColor};
        fill-opacity: 0.2;
    }
    @keyframes dash {
        to {
            stroke-dashoffset: 0;
        }
    }
    @keyframes stroke {
        to {
            stroke: ${blueColor};
        }
    }
`);

// define link style
let linkStyle = getLinkStyle();

// add the styles to the canvas
paper.svg.prepend(styles);
paper.svg.prepend(linkStyle);

var zoomLevel = 1;

// zooming control
document.getElementById('zoom-in').addEventListener('click', function () {
    // changing the zoom level by adding to the level
    zoomLevel = Math.min(3, zoomLevel + 0.2);
    // change the size of the new canvas
    var size = paper.getComputedSize();
    paper.translate(0, 0);
    // change the scales
    paper.scale(zoomLevel, zoomLevel, size.width / 2, size.height / 2);
});

// zoom contorl for zooming out
document.getElementById('zoom-out').addEventListener('click', function () {
    // decreasing the zoom level
    zoomLevel = Math.max(0.2, zoomLevel - 0.2);
    // adjusting size and zoom level
    var size = paper.getComputedSize();
    paper.translate(0, 0);
    paper.scale(zoomLevel, zoomLevel, size.width / 2, size.height / 2);
});

// toggling the view of the canvas
function toggleView(editMode) {
    // for each element
    for (const element of graph.getElements()) {
        // make it editable
        if (editMode == "edit") {
            element.attr('body/cursor', 'move');
        // make it viewable and not editable
        } else if (editMode == "view") {
            element.attr('body/cursor', 'pointer');
        }
    }

    // if the edit mode is on
    if (editMode == "edit") {
        // stop listening for view commands
        viewController.stopListening();
        editController.startListening();
        // hide any path that is displayed
        hidePath();
        // remove all path styling
        if (startView) {
            joint.highlighters.mask.remove(startView, highlightId);
            joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
        }
        if (endView) {
            joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
        }
    // if the view mode is on
    } else if (editMode == "view") {
        // start listening for view commands
        viewController.startListening();
        editController.stopListening();
        // show the path
        showPath();
        // add highlighters when requested
        if (startView) {
            joint.highlighters.mask.add(startView, 'body', highlightId, startAttrs);
        }
    }
}

// listening for save button press
document.addEventListener("DOMContentLoaded", function () {
    // map name input cell
    const mapNameInput = document.getElementById('mapName');
    // get the element id of the button
    document.getElementById('saveMap').addEventListener('click', function () {
        const mapName = mapNameInput.value;
        // save the map with the name that was entered
        saveMap(mapName);
        // clear the input box
        mapNameInput.value = '';
    });
});

// load maps when the site loads
window.onload = function () {
    loadMaps()
};

// loading the maps
function loadMaps() {
    // get the maps from the backend
    getMaps()
        // populate the table after maps are received
        .then((maps) => populateTable(maps))
        .catch((error) => console.error('Error loading maps:', error));
}

// populate the table with the maps
function populateTable(maps) {
    // define what the table is
    const tableBody = document.getElementById('table-body');
    // clear the table
    tableBody.innerHTML = '';

    // change the load button appearance
    function updateLoadButtonsState() {
        // if there is an element on the map
        const hasElementsOnMap = graph.getElements().length > 0 || graph.getLinks().length > 0;
        // find all load buttons
        const loadButtons = document.querySelectorAll('.btn-load-map');
        // loop through all the buttons
        loadButtons.forEach(button => {
            // if there is an element on the canvas
            if (hasElementsOnMap) {
                // disable the buttons
                button.classList.add('btn-disabled');
                button.disabled = true;
            } else {
                // if not then remove the disables tag
                button.classList.remove('btn-disabled');
                button.disabled = false;
            }
        });
    }

    // for each of the maps on the table
    maps.forEach((map, index) => {
        // define the table elements
        const row = document.createElement('tr');
        const mapNameCell = document.createElement('td');
        const mapNameButton = document.createElement('button');
        // set the styling
        mapNameButton.className = 'btn btn-neutral';
        mapNameButton.textContent = map.mapName;
        // create a new map display
        mapNameCell.appendChild(mapNameButton);
        row.appendChild(mapNameCell);
        // create the load button
        const loadCell = document.createElement('td');
        const loadButton = document.createElement('button');
        loadButton.className = 'btn btn-outline btn-info btn-load-map';
        loadButton.textContent = 'Load';
        // add a listener to check if the button is pressed
        loadButton.addEventListener('click', () => {
            // if the button is not disabled
            if (!loadButton.classList.contains('btn-disabled')) {
                // load the map
                loadMap(map);
                // update the load button state to disabled
                updateLoadButtonsState();
            }
        });
        // add the button to the table
        loadCell.appendChild(loadButton);
        row.appendChild(loadCell);
        // add the delete button
        const deleteCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-outline btn-error';
        deleteButton.textContent = 'Delete';
        // listen for a click on the delete button to delete that map id
        deleteButton.addEventListener('click', () => deleteMap(map.id));
        // add the button to the table
        deleteCell.appendChild(deleteButton);
        row.appendChild(deleteCell);
        // add a new row on the table
        tableBody.appendChild(row);
    });

    // if the graph changes, update the button state
    graph.on('change', updateLoadButtonsState);
    // when the graph is cleared
    graph.on('clear', () => {
        // reset the button state
        const loadButtons = document.querySelectorAll('.btn-load-map');
        // for each button remove the disabled tag
        loadButtons.forEach(button => {
            button.classList.remove('btn-disabled');
            button.disabled = false;
        });
    });
    // update the button states
    updateLoadButtonsState();
}

// loading maps onto the canvas
function loadMap(map) {
    console.log(map);
    // set the index at 0
    current_index = 0;
    const nodesData = JSON.parse(map.nodeMap);

    // clear the graph
    graph.clear();
    // start with an empty map array
    map_array = [];

    // for each of the data nodes in the data from the map
    nodesData.forEach(nodeData => {
        // define the format for the nodes
        const { id, x, y, end } = nodeData;

        // skip deleted nodes from the maps
        if (x === "n/a" || y === "n/a") {
            console.warn(`Skipping node with id ${id} due to invalid coordinates.`);
            current_index++
            return;
        }

        // add an element with each node iteration
        addElement({ createNode, size: 40 }, null, x, y);
        // add that node to the map array
        map_array.push({ id, x, y, end });
    });

    // for each of the nodes
    nodesData.forEach(nodeData => {
        // look at the connection for each node
        const { id, end } = nodeData;
        // if there is a connection that exists
        if (end && Array.isArray(end)) {
            // for each of the target ids defined in the end array
            end.forEach(targetId => {
                // create a new link
                createLink(id, targetId);
            });
        }
    });
}

// ddelete a map from the menu
function deleteMap(mapId) {
    // request link
    const backendURL = `http://127.0.0.1:8199/api/deleteMap/${mapId}`;
    const xhr = new XMLHttpRequest();
    // create a delete request
    xhr.open('DELETE', backendURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    // when the server responds
    xhr.onload = function () {
        // if the status is successful
        if (xhr.status >= 200 && xhr.status < 300) {
            // load the maps into the table
            loadMaps();
        } else {
            // log error
            console.error('Failed to delete map:', xhr.status);
        }
    };

    // if there is an error with the request, log
    xhr.onerror = function () {
        console.error('Request failed');
    };

    // send the request
    xhr.send();
}

// clear the map
function clearMap() {
    // clearing the map
    graph.clear()
    // resetting the index
    current_index = 0;
    // reload the window
    window.location.reload();
}