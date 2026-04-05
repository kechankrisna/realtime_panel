<?php

namespace Tests\Unit\Helpers;

use Tests\TestCase;

class PrometheusHelperTest extends TestCase
{
    public function test_parses_single_metric_line(): void
    {
        $metrics = 'soketi_connected_clients{app_id="demo-app",namespace=""} 3';

        $result = parse_prometheus('soketi_connected_clients', $metrics);

        $this->assertCount(1, $result);
        $this->assertEquals('soketi_connected_clients', $result->first()['key']);
        $this->assertEquals('demo-app', $result->first()['json']['app_id']);
        $this->assertEquals('', $result->first()['json']['namespace']);
        $this->assertEquals('3', $result->first()['value']);
    }

    public function test_parses_multiple_metric_lines(): void
    {
        $metrics = implode("\n", [
            'soketi_connected_clients{app_id="app-one",namespace=""} 1',
            'soketi_connected_clients{app_id="app-two",namespace=""} 5',
        ]);

        $result = parse_prometheus('soketi_connected_clients', $metrics);

        $this->assertCount(2, $result);
    }

    public function test_returns_empty_collection_when_key_not_found(): void
    {
        $metrics = 'other_metric{app_id="demo"} 42';

        $result = parse_prometheus('soketi_connected_clients', $metrics);

        $this->assertCount(0, $result);
    }

    public function test_parses_scientific_notation_value(): void
    {
        $metrics = 'soketi_messages_sent_total{app_id="demo",namespace=""} 1.5e+3';

        $result = parse_prometheus('soketi_messages_sent_total', $metrics);

        $this->assertCount(1, $result);
        $this->assertEquals('1.5e+3', $result->first()['value']);
    }

    public function test_returns_collection_instance(): void
    {
        $result = parse_prometheus('soketi_connected_clients', '');

        $this->assertInstanceOf(\Illuminate\Support\Collection::class, $result);
    }

    public function test_trims_quotes_from_label_values(): void
    {
        $metrics = 'soketi_connected_clients{app_id="my-app",namespace="ns"} 1';

        $result = parse_prometheus('soketi_connected_clients', $metrics);

        $json = $result->first()['json'];
        $this->assertSame('my-app', $json['app_id']);
        $this->assertSame('ns', $json['namespace']);
    }
}
