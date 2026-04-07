<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metric_snapshots', function (Blueprint $table) {
            $table->foreignId('application_id')->constrained('applications')->cascadeOnDelete();
            $table->timestamp('recorded_at');
            $table->mediumInteger('connections')->unsigned()->default(0);
            $table->primary(['application_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metric_snapshots');
    }
};
