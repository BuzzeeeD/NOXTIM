// scripts.js
var map = L.map('map').setView([-22.433833, -42.983269], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; OpenStreetMap contributors'
}).addTo(map);

L.control.fullscreen().addTo(map);

var markers = [];
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var distritosData = {};
var bairrosData = {};
var referenciasData = {};
var selectedMarkers = [];
var editingMarker = null;
var isBrushing = false;
var brushStart = null;
var brushEnd = null;
var brushLayer = null;

var drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: {
        polygon: true,
        rectangle: true,
        circle: false,
        marker: true,
        polyline: false
    }
});

var wifiIcon = L.icon({
    iconUrl: 'https://cdn.pixabay.com/photo/2021/03/27/12/32/free-wifi-icon-6128369_1280.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

var phoneTowerIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/283/283136.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

document.getElementById('toggle-sidebar').addEventListener('click', function() {
    var sidebar = document.getElementById('sidebar');
    var sidebarButton = document.getElementById('sidebar-button');
    if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
    } else {
        sidebar.classList.add('collapsed');
    }
});

document.getElementById('sidebar-button').addEventListener('click', function() {
    var sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('collapsed');
});

document.getElementById('show-radius').addEventListener('change', function(event) {
    if (event.target.checked) {
        showWifiZones();
    } else {
        hideWifiZones();
    }
});

var wifiZones = [];

function showWifiZones() {
    markers.forEach(function(marker) {
        if (marker.options.icon === wifiIcon) {
            var circle = L.circle(marker.getLatLng(), {
                color: 'blue',
                fillColor: 'blue',
                fillOpacity: 0.1,
                radius: 80
            }).addTo(map);
            wifiZones.push(circle);
        }
    });
}

function hideWifiZones() {
    wifiZones.forEach(function(circle) {
        map.removeLayer(circle);
    });
    wifiZones = [];
}

function getIconByColor(color) {
    switch(color.toLowerCase()) {
        case 'red':
            return { icon: L.circleMarker, options: { radius: 2, fillColor: 'red', color: 'red', weight: 1, opacity: 1, fillOpacity: 1 }};
        case 'blue':
            return { icon: L.circleMarker, options: { radius: 2, fillColor: 'blue', color: 'blue', weight: 1, opacity: 1, fillOpacity: 1 }};
        case 'wifi':
            return { icon: wifiIcon };
        case 'antena':
            return { icon: phoneTowerIcon };
        default:
            return { icon: L.circleMarker, options: { radius: 2, fillColor: color, color: color, weight: 1, opacity: 1, fillOpacity: 1 }};
    }
}

map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, function(e) {
    var layer = e.layer;
    var shape = layer.toGeoJSON();
    selectedMarkers = markers.filter(marker => 
        isMarkerInsideShape(marker.getLatLng(), shape) && marker.options.fillColor !== 'blue'
    );
    selectedMarkers.forEach(marker => {
        marker.setStyle({ fillColor: 'blue', color: 'blue' });
    });
    if (selectedMarkers.length > 0) {
        showPopup();
    }
    drawnItems.removeLayer(layer);
});

function isMarkerInsideShape(latlng, shape) {
    var point = turf.point([latlng.lng, latlng.lat]);
    var polygon = turf.polygon(shape.geometry.coordinates);
    return turf.booleanPointInPolygon(point, polygon);
}

function showPopup() {
    document.getElementById('popup-form').style.display = 'block';
}

document.getElementById('popup-save').addEventListener('click', function() {
    var referencia = document.getElementById('popup-name-edit').value;
    var novoBairro = document.getElementById('popup-bairro-edit').value;

    if (referencia) {
        selectedMarkers.forEach(marker => {
            marker.options.referencia = referencia;
            marker.setStyle({ fillColor: 'blue', color: 'blue' });
            if (novoBairro) {
                marker.options.bairro = novoBairro;
            }
            updateCounts(marker.options.bairro, marker.options.distrito);
        });
        generateCenterMarker(referencia);
        updateReferenciaData(referencia);
        renderReferenciasList();
        document.getElementById('popup-form').style.display = 'none';
        selectedMarkers = [];
        
        var center = calculateCenterCoordinates(selectedMarkers.map(marker => marker.getLatLng()));
        if (!window.baloes) {
            window.baloes = [];
        }
        window.baloes.push({
            lat: center.lat,
            lng: center.lng,
            referencia: 'balão',
            valor: 1
        });
    }
});

function calculateCenterCoordinates(points) {
    var sumLat = 0, sumLng = 0;
    points.forEach(point => {
        sumLat += point.lat;
        sumLng += point.lng;
    });
    return {
        lat: sumLat / points.length,
        lng: sumLng / points.length
    };
}

function generateCenterMarker(referencia) {
    if (selectedMarkers.length > 0) {
        var center = calculateCenterCoordinates(selectedMarkers.map(marker => marker.getLatLng()));
        var centerMarker = L.marker(center).addTo(map).bindPopup(referencia).openPopup();
        
        selectedMarkers.forEach(marker => {
            marker.options.centerMarkerLat = center.lat;
            marker.options.centerMarkerLng = center.lng;
            marker.options.centerMarkerReferencia = referencia;
        });

        if (!window.centerMarkers) {
            window.centerMarkers = [];
        }
        window.centerMarkers.push({
            lat: center.lat,
            lng: center.lng,
            referencia: referencia
        });
    }
}

document.getElementById('export-blue').addEventListener('click', function() {
    exportBlueData();
});

document.getElementById('generate-neighborhood-report').addEventListener('click', function() {
    generateNeighborhoodReport();
});

function generateNeighborhoodReport() {
    var neighborhoodData = [];

    for (var bairro in bairrosData) {
        if (bairrosData.hasOwnProperty(bairro)) {
            neighborhoodData.push({
                Bairro: bairro,
                Quantidade: bairrosData[bairro].selected
            });
        }
    }

    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(neighborhoodData);
    XLSX.utils.book_append_sheet(wb, ws, "Relatório de Bairros");

    XLSX.writeFile(wb, 'relatorio_bairros.xlsx');
}

function exportBlueData() {
    var exportData = markers.filter(marker => marker.options.fillColor === 'blue').map(function(marker) {
        return {
            "Acervo do Bairro": marker.options.acervo || "",
            Bairro: marker.options.bairro,
            Distrito: marker.options.distrito,
            Longitude: marker.getLatLng().lng * 1000000,
            Latitude: marker.getLatLng().lat * 1000000,
            Cor: marker.options.fillColor,
            Valor: marker.options.value || "",
            Referencia: marker.options.referencia || "",
        };
    });

    if (window.baloes) {
        window.baloes.forEach(function(balao) {
            exportData.push({
                "Acervo do Bairro": "",
                Bairro: "",
                Distrito: "",
                Longitude: balao.lng * 1000000,
                Latitude: balao.lat * 1000000,
                Cor: "",
                Valor: balao.valor.toString(),
                Referencia: balao.referencia,
            });
        });
    }

    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Pontos Azuis");

    XLSX.writeFile(wb, 'pontos_azuis.xlsx');
}

document.querySelectorAll('.filter-checkbox').forEach(function(checkbox) {
    checkbox.addEventListener('change', function() {
        filterMarkers();
    });
});

function filterMarkers() {
    var selectedBairro = document.getElementById('filter-bairro').value;
    var filters = Array.from(document.querySelectorAll('.filter-checkbox:checked')).map(function(checkbox) {
        return checkbox.value;
    });

    markers.forEach(function(marker) {
        var markerColor = marker.options.fillColor;
        var markerIcon = marker.options.icon;
        var markerBairro = marker.options.bairro;

        var matchColor = filters.length === 0 || filters.includes(markerColor) || 
                         (filters.includes('wifi') && markerIcon === wifiIcon) || 
                         (filters.includes('antena') && markerIcon === phoneTowerIcon);
        
        var matchBairro = selectedBairro === 'all' || markerBairro === selectedBairro;

        if (matchColor && matchBairro) {
            map.addLayer(marker);
        } else {
            map.removeLayer(marker);
        }
    });
}

document.getElementById('edit-cancel').addEventListener('click', function() {
    document.getElementById('edit-popup-form').style.display = 'none';
    editingMarker = null;
});

function showPopup() {
    document.getElementById('popup-form').style.display = 'block';
    populateBairroSelect();
    preSelectBairro();
}

function populateBairroSelect() {
    var bairroSelect = document.getElementById('popup-bairro');
    bairroSelect.innerHTML = '';
    var bairros = new Set(markers.map(marker => marker.options.bairro));
    bairros.forEach(bairro => {
        var option = document.createElement('option');
        option.value = bairro;
        option.text = bairro;
        bairroSelect.appendChild(option);
    });
}

function preSelectBairro() {
    var bairroSelect = document.getElementById('popup-bairro');
    var bairroCounts = {};
    selectedMarkers.forEach(marker => {
        var bairro = marker.options.bairro;
        if (!bairroCounts[bairro]) {
            bairroCounts[bairro] = 0;
        }
        bairroCounts[bairro]++;
    });

    var predominantBairro = Object.keys(bairroCounts).reduce((a, b) => bairroCounts[a] > bairroCounts[b] ? a : b);
    bairroSelect.value = predominantBairro;
}

document.getElementById('popup-save').addEventListener('click', function() {
    var referencia = document.getElementById('popup-name').value;
    var novoBairro = document.getElementById('popup-bairro').value;

    if (referencia) {
        selectedMarkers.forEach(marker => {
            marker.options.referencia = referencia;
            marker.setStyle({ fillColor: 'blue', color: 'blue' });
            if (novoBairro) {
                marker.options.bairro = novoBairro;
            }
            updateCounts(marker.options.bairro, marker.options.distrito);
        });
        generateCenterMarker(referencia);
        updateReferenciaData(referencia);
        renderReferenciasList();
        document.getElementById('popup-form').style.display = 'none';
        selectedMarkers = [];

        var center = calculateCenterCoordinates(selectedMarkers.map(marker => marker.getLatLng()));
        if (!window.baloes) {
            window.baloes = [];
        }
        window.baloes.push({
            lat: center.lat,
            lng: center.lng,
            referencia: 'balão',
            valor: 1
        });
    }
});

document.getElementById('popup-cancel').addEventListener('click', function() {
    selectedMarkers.forEach(marker => {
        marker.setStyle({ fillColor: 'red', color: 'red' });
    });
    document.getElementById('popup-form').style.display = 'none';
    selectedMarkers = [];
});

document.getElementById('edit-save').addEventListener('click', function() {
    if (editingMarker) {
        var acervo = document.getElementById('edit-acervo').value;
        var bairro = document.getElementById('edit-bairro').value;
        var distrito = document.getElementById('edit-distrito').value;
        var lat = parseFloat(document.getElementById('edit-lat').value);
        var lng = parseFloat(document.getElementById('edit-lng').value);
        var status = document.getElementById('edit-status').value.toLowerCase();
        var referencia = document.getElementById('edit-referencia').value;

        map.removeLayer(editingMarker);
        markers = markers.filter(marker => marker !== editingMarker);

        if (editingMarker.options.referencia && referenciasData[editingMarker.options.referencia]) {
            referenciasData[editingMarker.options.referencia][editingMarker.options.bairro]--;
            if (referenciasData[editingMarker.options.referencia][editingMarker.options.bairro] === 0) {
                delete referenciasData[editingMarker.options.referencia][editingMarker.options.bairro];
            }
            if (Object.keys(referenciasData[editingMarker.options.referencia]).length === 0) {
                delete referenciasData[editingMarker.options.referencia];
            }
        }

        if (distritosData[editingMarker.options.distrito]) {
            distritosData[editingMarker.options.distrito].selected--;
        }
        if (bairrosData[editingMarker.options.bairro]) {
            bairrosData[editingMarker.options.bairro].selected--;
        }

        var newMarkerOptions = {
            acervo: acervo,
            bairro: bairro,
            distrito: distrito,
            fillColor: status,
            color: status,
            referencia: referencia
        };

        var iconData = getIconByColor(status);
        var newMarker;
        if (typeof iconData.icon === 'function') {
            newMarker = iconData.icon([lat, lng], newMarkerOptions);
        } else {
            newMarker = L.marker([lat, lng], { icon: iconData.icon, ...newMarkerOptions });
        }

        handleMarkerClick(newMarker);
        markers.push(newMarker);
        map.addLayer(newMarker);

        if (referencia) {
            if (!referenciasData[referencia]) {
                referenciasData[referencia] = {};
            }
            if (!referenciasData[referencia][bairro]) {
                referenciasData[referencia][bairro] = 0;
            }
            referenciasData[referencia][bairro]++;
        }

        if (!distritosData[distrito]) {
            distritosData[distrito] = { selected: 0, total: 0 };
        }
        distritosData[distrito].selected++;
        if (!bairrosData[bairro]) {
            bairrosData[bairro] = { selected: 0, total: 0 };
        }
        bairrosData[bairro].selected++;

        renderReferenciasList();
        updateTopStats();
        renderBairrosList();

        document.getElementById('edit-popup-form').style.display = 'none';
        editingMarker = null;
    }
});

function updateReferenciaData(referencia) {
    if (!referenciasData[referencia]) {
        referenciasData[referencia] = {};
    }
    selectedMarkers.forEach(marker => {
        var bairro = marker.options.bairro;
        if (!referenciasData[referencia][bairro]) {
            referenciasData[referencia][bairro] = 0;
        }
        referenciasData[referencia][bairro]++;
    });
}

function renderReferenciasList() {
    var referenciasList = document.getElementById('referencias-list');
    referenciasList.innerHTML = '';
    var referenciasArray = [];
    for (var referencia in referenciasData) {
        if (referenciasData.hasOwnProperty(referencia)) {
            for (var bairro in referenciasData[referencia]) {
                if (referenciasData[referencia].hasOwnProperty(bairro)) {
                    referenciasArray.push({
                        referencia: referencia,
                        bairro: bairro,
                        count: referenciasData[referencia][bairro]
                    });
                }
            }
        }
    }
    referenciasArray.sort((a, b) => b.count - a.count);
    referenciasArray.forEach(ref => {
        var container = document.createElement('div');
        container.className = 'bar-container';
        var barWidth = ref.count * 10;
        container.innerHTML = `
            <span>${ref.referencia}/${ref.bairro} (${ref.count})</span>
            <div class="bar" style="width: ${barWidth}px;"></div>
        `;
        referenciasList.appendChild(container);
    });
}

document.getElementById('upload').style.display = 'none';

function loadExcelAutomatically() {
    fetch('data/Banco de Dados.xlsx')
        .then(response => response.arrayBuffer())
        .then(data => {
            var workbook = XLSX.read(data, { type: 'array' });
            var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            var jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            processExcelData(jsonData);
        })
        .catch(error => console.error('Error loading the Excel file:', error));
}

document.addEventListener('DOMContentLoaded', function() {
    loadExcelAutomatically();
});

function readExcelFile(file, callback) {
    var reader = new FileReader();
    reader.onload = function(event) {
        var data = new Uint8Array(event.target.result);
        var workbook = XLSX.read(data, { type: 'array' });
        var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        var jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        callback(jsonData);
    };
    reader.readAsArrayBuffer(file);
}

function processExcelData(data) {
    var bairrosSet = new Set();
    data.forEach(function(row, index) {
        if (index > 0) {
            var lat = parseFloat(row[4]) / 1000000;
            var lng = parseFloat(row[3]) / 1000000;
            var bairro = row[1];
            var distrito = row[2];
            var status = row[5] ? row[5].toLowerCase() : '';
            var valor = row[6] || "";
            var referencia = row[7] || "";
            var isCenterMarker = row[8] == 1;

            if (!isNaN(lat) && !isNaN(lng)) {
                if (!bairrosData[bairro]) {
                    bairrosData[bairro] = { selected: 0, total: 0 };
                }
                bairrosData[bairro].total++;
                bairrosSet.add(bairro);

                if (!distritosData[distrito]) {
                    distritosData[distrito] = { selected: 0, total: 0 };
                }
                distritosData[distrito].total++;

                var iconData = getIconByColor(status);
                var markerOptions = {
                    bairro: bairro,
                    distrito: distrito,
                    acervo: row[0] || "",
                    valor: valor,
                    referencia: referencia,
                    isCenterMarker: isCenterMarker,
                    fillColor: status,
                    color: status,
                    radius: 2,
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 1
                };

                var marker;
                if (typeof iconData.icon === 'function') {
                    marker = iconData.icon([lat, lng], markerOptions);
                } else {
                    marker = L.marker([lat, lng], { icon: iconData.icon, ...markerOptions });
                }

                if (status === 'blue') {
                    updateCounts(bairro, distrito);
                }
                if (referencia) {
                    if (!referenciasData[referencia]) {
                        referenciasData[referencia] = {};
                    }
                    if (!referenciasData[referencia][bairro]) {
                        referenciasData[referencia][bairro] = 0;
                    }
                    referenciasData[referencia][bairro]++;
                }
                handleMarkerClick(marker);
                markers.push(marker);
                map.addLayer(marker);

                if (isCenterMarker) {
                    L.marker([lat, lng]).addTo(map).bindPopup(referencia).openPopup();
                }
            }
        }
    });

    var bairroFilter = document.getElementById('filter-bairro');
    bairroFilter.innerHTML = '<option value="all">Todos os Bairros</option>';
    bairrosSet.forEach(bairro => {
        var option = document.createElement('option');
        option.value = bairro;
        option.text = bairro;
        bairroFilter.appendChild(option);
    });

    renderBairrosList();
    renderReferenciasList();
    updateTopStats();
}

function handleMarkerClick(marker) {
    marker.on('dblclick', function() {
        editingMarker = marker;
        document.getElementById('edit-acervo').value = marker.options.acervo || '';
        document.getElementById('edit-bairro').value = marker.options.bairro || '';
        document.getElementById('edit-distrito').value = marker.options.distrito || '';
        document.getElementById('edit-lat').value = marker.getLatLng().lat;
        document.getElementById('edit-lng').value = marker.getLatLng().lng;
        document.getElementById('edit-status').value = marker.options.fillColor || '';
        document.getElementById('edit-referencia').value = marker.options.referencia || '';
        document.getElementById('edit-popup-form').style.display = 'block';
    });
}

document.getElementById('view-bairros').addEventListener('click', function() {
    toggleView('bairros');
});

document.getElementById('view-referencias').addEventListener('click', function() {
    toggleView('referencias');
});

function toggleView(view) {
    document.getElementById('view-bairros').classList.remove('active');
    document.getElementById('view-referencias').classList.remove('active');
    if (view === 'bairros') {
        document.getElementById('view-bairros').classList.add('active');
        document.getElementById('bairros-list').style.display = 'block';
        document.getElementById('referencias-list').style.display = 'none';
    } else {
        document.getElementById('view-referencias').classList.add('active');
        document.getElementById('bairros-list').style.display = 'none';
        document.getElementById('referencias-list').style.display = 'block';
    }
}

document.getElementById('reset').addEventListener('click', function() {
    if (confirm("Tem certeza que deseja apagar?")) {
        resetCounts();
        markers.forEach(function(marker) {
            marker.setStyle({ fillColor: 'red', color: 'red' });
            marker.options.referencia = "";
            marker.options.value = "";
            marker.unbindTooltip();
        });
        referenciasData = {};
        renderReferenciasList();
        updateTopStats();
    }
});

document.getElementById('delete-selected').addEventListener('click', function() {
    if (confirm("Tem certeza que deseja apagar?")) {
        var newMarkers = [];
        markers.forEach(function(marker) {
            if (marker.options.fillColor !== 'blue') {
                newMarkers.push(marker);
            } else {
                updateCounts(marker.options.bairro, marker.options.distrito, false);
                map.removeLayer(marker);
            }
        });
        markers = newMarkers;
        renderBairrosList();
        renderReferenciasList();
        updateTopStats();
    }
});

document.getElementById('generate-report').addEventListener('click', function() {
    generateReport();
});

function generateReport() {
    var reportData = [];
    for (var referencia in referenciasData) {
        if (referenciasData.hasOwnProperty(referencia)) {
            for (var bairro in referenciasData[referencia]) {
                if (referenciasData[referencia].hasOwnProperty(bairro)) {
                    reportData.push({
                        Referência: referencia,
                        Bairro: bairro,
                        Quantidade: referenciasData[referencia][bairro]
                    });
                }
            }
        }
    }
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(reportData);
    XLSX.utils.book_append_sheet(wb, ws, "Relatório de Referências");
    XLSX.writeFile(wb, 'relatorio_referencias.xlsx');
}

document.getElementById('filter-bairro').addEventListener('change', function() {
    filterMarkersByBairro(this.value);
});

function filterMarkersByBairro(bairro) {
    markers.forEach(function(marker) {
        if (bairro === 'all') {
            map.addLayer(marker);
        } else {
            if (marker.options.bairro === bairro) {
                map.addLayer(marker);
            } else {
                map.removeLayer(marker);
            }
        }
    });
}

function updateCounts(bairro, distrito, increment = true) {
    if (!distritosData[distrito]) {
        distritosData[distrito] = { selected: 0, total: 0 };
    }
    distritosData[distrito].selected += increment ? 1 : -1;

    if (!bairrosData[bairro]) {
        bairrosData[bairro] = { selected: 0, total: 0 };
    }
    bairrosData[bairro].selected += increment ? 1 : -1;

    renderBairrosList();
    updateTopStats();
    updateCounter(increment ? 1 : -1);
}

function renderBairrosList() {
    var bairrosList = document.getElementById('bairros-list');
    bairrosList.innerHTML = '';
    for (var bairro in bairrosData) {
        var bairroData = bairrosData[bairro];
        var barWidth = (bairroData.selected / bairroData.total) * 100;
        var barContainer = document.createElement('div');
        barContainer.className = 'bar-container';
        barContainer.innerHTML = `
            <span>${bairro} (${bairroData.selected}/${bairroData.total})</span>
            <div class="bar" style="width: ${barWidth}%;"></div>
        `;
        bairrosList.appendChild(barContainer);
    }
}

function updateTopStats() {
    var topStats = document.getElementById('top-stats');
    topStats.innerHTML = 'Sensores por Distrito:';
    for (var distrito in distritosData) {
        if (distritosData.hasOwnProperty(distrito)) {
            topStats.innerHTML += ` | ${distrito}: ${distritosData[distrito].selected}`;
        }
    }
}

document.getElementById('edit-delete').addEventListener('click', function() {
    if (editingMarker) {
        map.removeLayer(editingMarker);
        markers = markers.filter(marker => marker !== editingMarker);

        if (editingMarker.options.referencia && referenciasData[editingMarker.options.referencia]) {
            referenciasData[editingMarker.options.referencia][editingMarker.options.bairro]--;
            if (referenciasData[editingMarker.options.referencia][editingMarker.options.bairro] === 0) {
                delete referenciasData[editingMarker.options.referencia][editingMarker.options.bairro];
            }
            if (Object.keys(referenciasData[editingMarker.options.referencia]).length === 0) {
                delete referenciasData[editingMarker.options.referencia];
            }
        }

        if (distritosData[editingMarker.options.distrito]) {
            distritosData[editingMarker.options.distrito].selected--;
        }
        if (bairrosData[editingMarker.options.bairro]) {
            bairrosData[editingMarker.options.bairro].selected--;
        }

        renderReferenciasList();
        updateTopStats();
        renderBairrosList();

        document.getElementById('edit-popup-form').style.display = 'none';
        editingMarker = null;
    }
});

document.getElementById('export').addEventListener('click', function() {
    exportData();
});

function exportData() {
    var exportData = markers.map(function(marker) {
        return {
            "Acervo do Bairro": marker.options.acervo || "",
            Bairro: marker.options.bairro,
            Distrito: marker.options.distrito,
            Longitude: marker.getLatLng().lng * 1000000,
            Latitude: marker.getLatLng().lat * 1000000,
            Cor: marker.options.fillColor,
            Valor: marker.options.value || "",
            Referência: marker.options.referencia || ""
        };
    });

    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Dados de Marcadores");

    XLSX.writeFile(wb, 'dados_marcadores.xlsx');
}

map.on('mousedown', function(event) {
    if (event.originalEvent.shiftKey) {
        isBrushing = true;
        brushStart = event.latlng;
        brushLayer = L.rectangle([brushStart, brushStart], { color: "#ff7800", weight: 1 }).addTo(map);
    }
});

map.on('mousemove', function(event) {
    if (isBrushing) {
        brushEnd = event.latlng;
        brushLayer.setBounds(L.latLngBounds(brushStart, brushEnd));
    }
});

map.on('mouseup', function(event) {
    if (isBrushing) {
        isBrushing = false;
        var bounds = brushLayer.getBounds();
        var selectedPoints = 0;

        markers.forEach(function(marker) {
            if (bounds.contains(marker.getLatLng()) && marker.options.fillColor !== 'blue') {
                marker.setStyle({ fillColor: 'blue', color: 'blue' });
                selectedPoints++;
                updateCounts(marker.options.bairro, marker.options.distrito);
            }
        });

        updateCounter(selectedPoints);
        map.removeLayer(brushLayer);
        updateTopStats();
    }
});

function resetCounts() {
    for (var key in bairrosData) {
        if (bairrosData.hasOwnProperty(key)) {
            bairrosData[key].selected = 0;
        }
    }
    for (var key in distritosData) {
        if (distritosData.hasOwnProperty(key)) {
            distritosData[key].selected = 0;
        }
    }
    document.getElementById('selected-count').innerText = 0;
    referenciasData = {};
    renderBairrosList();
    renderReferenciasList();
    updateTopStats();
}

function updateCounter(amount = 0) {
    var counter = document.getElementById('selected-count');
    var currentCount = parseInt(counter.innerText, 10);
    counter.innerText = currentCount + amount;
}

renderBairrosList();
renderReferenciasList();
updateTopStats();

function getAddress(lat, lng, callback) {
    var url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data && data.address) {
                callback(null, data.address);
            } else {
                callback('Endereço não encontrado');
            }
        })
        .catch(error => {
            callback(error);
        });
}

var isAddingMarker = false;

document.getElementById('add-marker').addEventListener('click', function() {
    isAddingMarker = !isAddingMarker;
    this.style.backgroundColor = isAddingMarker ? 'green' : '';
});

map.on('click', function(e) {
    if (isAddingMarker) {
        var popupForm = document.getElementById('new-marker-popup-form');
        popupForm.style.display = 'block';
        document.getElementById('new-lat').value = e.latlng.lat;
        document.getElementById('new-lng').value = e.latlng.lng;

        getAddress(e.latlng.lat, e.latlng.lng, function(error, address) {
            if (!error) {
                document.getElementById('new-bairro').value = address.suburb || '';
                
                var streetViewButton = document.getElementById('street-view-button');
                streetViewButton.onclick = function() {
                    window.open(`https://www.google.com/maps?q=&layer=c&cbll=${e.latlng.lat},${e.latlng.lng}`, '_blank');
                };
                streetViewButton.style.display = 'block';
            } else {
                console.error(error);
            }
        });
    }
});

document.getElementById('new-marker-save').addEventListener('click', function() {
    var acervo = document.getElementById('new-acervo').value;
    var bairro = document.getElementById('new-bairro').value;
    var distrito = document.getElementById('new-distrito').value;
    var lat = parseFloat(document.getElementById('new-lat').value);
    var lng = parseFloat(document.getElementById('new-lng').value);
    var tipo = document.getElementById('new-type').value;
    var referencia = document.getElementById('new-referencia').value;

    var iconData = getIconByColor(tipo);
    var markerOptions = {
        acervo: acervo,
        bairro: bairro,
        distrito: distrito,
        fillColor: tipo,
        color: tipo,
        referencia: referencia
    };

    var marker;
    if (typeof iconData.icon === 'function') {
        marker = iconData.icon([lat, lng], markerOptions).addTo(map).bindPopup(referencia);
    } else {
        marker = L.marker([lat, lng], { icon: iconData.icon, ...markerOptions }).addTo(map).bindPopup(referencia);
    }

    markers.push(marker);

    document.getElementById('new-marker-popup-form').style.display = 'none';
    isAddingMarker = false;
    document.getElementById('add-marker').style.backgroundColor = '';
});

document.getElementById('new-marker-cancel').addEventListener('click', function() {
    document.getElementById('new-marker-popup-form').style.display = 'none';
    isAddingMarker = false;
    document.getElementById('add-marker').style.backgroundColor = '';
});

function makePopupDraggable(popupId) {
    var popup = document.getElementById(popupId);
    var isMouseDown = false;
    var offsetX, offsetY;

    popup.addEventListener('mousedown', function(e) {
        if (e.target.tagName.toLowerCase() !== 'input' && e.target.tagName.toLowerCase() !== 'button' && e.target.tagName.toLowerCase() !== 'select') {
            isMouseDown = true;
            offsetX = e.clientX - popup.offsetLeft;
            offsetY = e.clientY - popup.offsetTop;
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (isMouseDown) {
            popup.style.left = `${e.clientX - offsetX}px`;
            popup.style.top = `${e.clientY - offsetY}px`;
        }
    });

    document.addEventListener('mouseup', function() {
        isMouseDown = false;
    });
}
makePopupDraggable('new-marker-popup-form');

document.getElementById('toggle-menu-button').addEventListener('click', function() {
    var menu = document.getElementById('menu');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        this.innerText = 'Ocultar Menu';
    } else {
        menu.classList.add('hidden');
        this.innerText = 'Mostrar Menu';
    }
});

document.getElementById('toggle-sidebar').addEventListener('click', function() {
    var sidebar = document.getElementById('sidebar');
    var sidebarButton = document.getElementById('sidebar-button');
    if (sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
        sidebarButton.style.display = 'none';
    } else {
        sidebar.classList.add('collapsed');
        sidebarButton.style.display = 'block';
    }
});

document.getElementById('sidebar-button').addEventListener('click', function() {
    var sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('collapsed');
    this.style.display = 'none';
});
