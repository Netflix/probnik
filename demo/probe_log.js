/**
 *
 *  Copyright 2019 Netflix, Inc.
 *
 *     Licensed under the Apache License, Version 2.0 (the "License");
 *     you may not use this file except in compliance with the License.
 *     You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 *     Unless required by applicable law or agreed to in writing, software
 *     distributed under the License is distributed on an "AS IS" BASIS,
 *     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *     See the License for the specific language governing permissions and
 *     limitations under the License.
 *
 */

export function probeLog(tableElem) {
    var results = [];

    var table = tableElem.DataTable({
        "columnDefs": [{
                // The `data` parameter refers to the data for the cell (defined by the
                // `data` option, which defaults to the column being worked with, in
                // this case `data: 0`.
                "render": function ( data, type, row ) {
                    return '<button class="probe-details-btn">JSON</button>';
                },
                "targets": 4
            }],
        });
    
    function formatSampleDetails(data) {
        var details = '<div class="container-fluid">' +
            '<table>'+
            '<thead>' + 
                '<th>Target</th>' + 
                '<th>URL</th>' + 
                '<th>Status</th>' + 
                '<th>Duration</th>' + 
            '</thead>' + 
            '<tbody>';
        data.data.forEach((sample) => {
            details += '<tr>'+
                '<td>' + sample.name + '</td>' +
                '<td>' + sample.target + '</td>' +
                '<td>' + sample.data[0].sc + '</td>' +
                '<td>' + sample.data[0].d + '</td>' +
            '</tr>';
        });
        details +='</tbody>'+ '</table> </div>';
        return details;
    }
    
    // Add event listener for opening and closing details
    $('#probes-log-table tbody').on('click', 'td', function (event) {
        var tr = $(this).closest('tr');
        var row = table.row( tr );
    
        var probe = results[row.data()[0]];
    
        if ($(event.target).hasClass('probe-details-btn')) {
            document.getElementById('probe-json').innerText = JSON.stringify(probe, null, '  ');
            $('#probe-details-modal').modal('show');
        } else {
            if ( row.child.isShown() ) {
                // This row is already open - close it
                row.child.hide();
                tr.removeClass('shown');
            }
            else {
                // Open this row
                row.child( formatSampleDetails(probe) ).show();
                tr.addClass('shown');
            }
        }
    } );

    return {
        addProbe: function(data) {
            results.push(data);
            table.row.add([results.length - 1, data.ctx.ts, data.type, data.name, '']).draw();
        },

        reset: function() {
            table.clear();   
        }
    }
}